"use server"

import type { Ticket, TicketStatus } from "@/lib/tickets"
import { checkAdminAccess, getSessionEmail } from "@/lib/auth"
import { getSupabaseUser } from "@/lib/supabase/auth-server"
import {
  getTicketFromDb,
  listTicketsFromDb,
  updateTicketReceiptInDb,
  updateTicketStatusInDb,
  upsertTicketInDbDetailed,
  type DbWriteError,
} from "@/lib/supabase/tickets"
import { resolveReceiptPublicUrl, isPublicUrl } from "@/lib/supabase/storage"
import { sendReceiptToTelegram, type ReceiptVerificationInput, type TelegramSendResult } from "@/lib/telegram"
import { runInBackground } from "@/lib/background"

/**
 * إجراءات الخادم للتذاكر على Supabase — مصدر الحقيقة للوحات التحكم.
 *
 * - `persistTicket`: يحفظ تذكرة كاملة عند إنشاء الحجز (status = pending).
 * - `listMyTickets`: يقرأ تذاكر مستخدم واحد حيًا من الجدول.
 * - `setTicketStatusServer`: يحدّث حالة التذكرة (أزرار قبول/رفض من اللوحات إن لزم).
 */

/** نتيجة حفظ التذكرة وإشعار الإدارة (تُعاد للواجهة لعرض حالة واضحة). */
export type PersistTicketResult = {
  /** هل حُفظت التذكرة في قاعدة البيانات؟ */
  ok: boolean
  /** هل جُدول إشعار الإدارة على تليجرام؟ (يُنفَّذ في الخلفية بلا حجب المتصفح). */
  notified: boolean
  /**
   * حالة الإشعار:
   *  - `queued`  = جُدول بعد إرجاع الاستجابة (`after`) — الواجهة لا تنتظره.
   *  - `failed`  = لم نستطع حفظ التذكرة/جدولة الإشعار.
   */
  notifyState: "queued" | "failed"
  /** هل محادثة العميل مربوطة بالتليجرام (لاستلام بطاقة التذكرة والـ QR)؟ */
  telegramLinked: boolean
  /** الرابط العام لصورة الإيصال (`receipt_url`) — يحل محل Base64 في التخزين المحلي. */
  receiptUrl?: string
  /** رسالة خطأ واضحة عند فشل الحفظ. */
  error?: string
}

/**
 * يبني مدخلات إرسال الإيصال إلى تليجرام من التذكرة نفسها (بلا حقول مكرّرة).
 * `receiptUrl` هو الرابط العام المباشر (`receipt_url`) ويُستخدم في البديل النصي
 * لو فشل تليجرام في معالجة صورة الإيصال (IMAGE_PROCESS_FAILED…).
 */
function receiptInputFromTicket(ticket: Ticket, receiptUrl?: string): ReceiptVerificationInput {
  return {
    ticketId: ticket.id,
    qrPayload: ticket.qrCode,
    showTitle: ticket.showTitle,
    venue: ticket.venue,
    seatsCount: ticket.seats.length,
    seatsLabel: ticket.seats.join("، "),
    totalCents: ticket.totalCents,
    senderPhone: ticket.senderPhone ?? "",
    receiptImage: ticket.receiptImage,
    receiptUrl: receiptUrl && isPublicUrl(receiptUrl) ? receiptUrl : undefined,
    paymentMethod: ticket.paymentMethod,
  }
}

/**
 * يترجم خطأ Supabase إلى رسالة مفهومة للمستخدم مع سبب تقني مختصر
 * (التفاصيل الكاملة — code/details/hint — تُطبع في لوج السيرفر).
 */
function describeDbFailure(error: DbWriteError): string {
  const hint =
    error.code === "not_configured"
      ? "مفتاح service_role غير مهيأ في بيئة السيرفر."
      : error.code === "PGRST204" || error.code === "42703"
        ? "أحد أعمدة الجدول غير موجود — طبّق scripts/supabase-schema.sql."
        : error.code === "42P01"
          ? "جدول tickets غير موجود في قاعدة البيانات."
          : error.code === "42501" || /row-level security/i.test(error.message)
            ? "صلاحيات مرفوضة (RLS) — يجب استخدام مفتاح service_role في السيرفر."
            : error.code === "22P02" || /invalid input syntax/i.test(error.message)
              ? "تعارض في نوع أحد الأعمدة (user_id)."
              : "تعذّر الاتصال بقاعدة البيانات."
  return `تعذّر حفظ التذكرة في قاعدة البيانات — ${hint} [${error.code ?? "?"}] ${error.message}`
}

/**
 * الـ Trigger الوحيد لإنشاء الطلب (Single Source of Truth):
 *  1) يرفع صورة الإيصال إلى Supabase Storage ويحفظ `publicUrl` في `receipt_url`.
 *  2) يحفظ التذكرة في جدول `tickets` (مصدر الحقيقة للوحات والويب هوك).
 *  3) **يجدول** إشعار الإدارة على تليجرام (صورة الإيصال + أزرار القبول/الرفض) لينفّذ
 *     بعد إرجاع الاستجابة — فلا ينتظر المتصفح نداءات تليجرام ولا تنزيل الصورة مرة أخرى.
 *  4) يعيد رابط الإيصال العام وهل محادثة العميل مربوطة (لإرسال بطاقة التذكرة له).
 */
export async function persistTicket(ticket: Ticket): Promise<PersistTicketResult> {
  try {
    // (1) رفع صورة الإيصال إلى Supabase Storage وحفظ رابطها العام في `receipt_url`.
    const receiptImage = await resolveReceiptPublicUrl(ticket.receiptImage, ticket.id)
    // الرابط العام المباشر (`receipt_url`) — يُرسل للأدمن كبديل لو فشلت معالجة الصورة.
    const receiptUrl = receiptImage && isPublicUrl(receiptImage) ? receiptImage : undefined
    const stored: Ticket = { ...ticket, receiptImage }

    // (2) حفظ التذكرة في قاعدة البيانات (مصدر الحقيقة للوحات والويب هوك).
    //     نستخدم النسخة التفصيلية لتسجيل سبب الفشل الحقيقي (code/details/hint)
    //     مع تدرّج آمن يمنع فقدان الطلب (أسقاط حقول غير متوافقة عند الحاجة).
    const write = await upsertTicketInDbDetailed(stored)
    const ok = write.ok
    if (!write.ok) {
      console.error(
        `[tickets] persistTicket ${ticket.id}: فشل حفظ التذكرة في Supabase (${write.attempts.join(" | ")})`,
      )
    } else if (write.degraded) {
      console.warn(`[tickets] persistTicket ${ticket.id}: حُفظت التذكرة بصيغة مختصرة (حقول مسقطة).`)
    }
    const saved = write.ok ? write.ticket : null

    // (3) إشعار الإدارة في الخلفية: لا يحجب المتصفح. تُستخدم البايتات الموجودة في اليد
    //     (بلا تنزيل من Storage) ويبقى `receipt_url` بديلًا نصيًا لو فشلت معالجة الصورة.
    const notifyInput = receiptInputFromTicket(stored, receiptUrl)
    await runInBackground(() => notifyAdmin(ticket.id, notifyInput), `إشعار الإدارة ${ticket.id}`)

    // (4) هل محادثة العميل مربوطة بالتليجرام؟ (من نتيجة الحفظ بلا قراءة إضافية).
    const linked = Boolean(saved?.telegramChatId)

    return {
      ok,
      notified: ok,
      notifyState: ok ? "queued" : "failed",
      telegramLinked: linked,
      receiptUrl,
      error: write.ok ? undefined : describeDbFailure(write.error),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[tickets] persistTicket ${ticket.id} failed: ${message}`)
    return { ok: false, notified: false, notifyState: "failed", telegramLinked: false, error: message }
  }
}

/** يرسل طلب الإدارة إلى تليجرام ويسجّل النتيجة بوضوح (بلا رمي أخطاء أبدًا). */
async function notifyAdmin(ticketId: string, input: ReceiptVerificationInput): Promise<void> {
  const result: TelegramSendResult = await sendReceiptToTelegram(input).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    code: "network" as const,
  }))

  if (result.ok) {
    console.log(`[tickets] أُرسل إشعار الإدارة للتذكرة ${ticketId} ✓ (mode=${result.mode ?? "?"})`)
    if (result.warning) console.warn(`[tickets] ${ticketId}: تم استخدام بديل — ${result.warning}`)
  } else {
    console.error(`[tickets] فشل إشعار الإدارة للتذكرة ${ticketId}: ${result.error}`)
  }
}

/**
 * إعادة إرسال إشعار الإدارة لتذكرة محفوظة (زر «إعادة إرسال الإشعار» في الواجهة) —
 * مفيد لو كان تليجرام غير متاح لحظة الحجز. يُجدول الإرسال في الخلفية أيضًا.
 */
export async function notifyTicketAdmin(ticketId: string): Promise<{ ok: boolean; error?: string }> {
  const id = ticketId.trim().toUpperCase()
  if (!id) return { ok: false, error: "مرجع التذكرة غير صالح." }
  try {
    const ticket = await getTicketFromDb(id)
    if (!ticket) return { ok: false, error: "لم نجد التذكرة لإعادة إرسال الإشعار." }

    const receiptUrl = ticket.receiptImage && isPublicUrl(ticket.receiptImage) ? ticket.receiptImage : undefined
    const input = receiptInputFromTicket(ticket, receiptUrl)
    await runInBackground(() => notifyAdmin(id, input), `إعادة إشعار الإدارة ${id}`)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[tickets] notifyTicketAdmin ${id} failed: ${message}`)
    return { ok: false, error: message }
  }
}

export async function listMyTickets(customerId?: string): Promise<Ticket[]> {
  // قراءة القائمة الكاملة (بلا معرّف مستخدم) = صلاحية أدمن فقط.
  if (!customerId || customerId.trim().length === 0) {
    const access = await checkAdminAccess()
    if (!access.allowed) return []
  }
  const rows = await listTicketsFromDb(customerId)
  return rows ?? []
}

export async function setTicketStatusServer(ticketId: string, status: TicketStatus): Promise<{ ok: boolean }> {
  try {
    if (!(await requireSignedIn())) return { ok: false }
    const updated = await updateTicketStatusInDb(ticketId.trim().toUpperCase(), status)
    return { ok: updated !== null }
  } catch (error) {
    console.error(`[tickets] setTicketStatusServer ${ticketId} failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}

/** هل يوجد مستخدم مسجّل (جلسة Supabase أو الجلسة المحلية)؟ */
async function requireSignedIn(): Promise<boolean> {
  const email = await getSessionEmail()
  if (email.length > 0) return true
  const user = await getSupabaseUser()
  return Boolean(user?.email)
}

/**
 * قائمة تذاكر المنصة للوحة المخرج/منظم العروض (مراجعة الإيصالات والمبيعات).
 * تتطلب وجود مستخدم مسجّل — وتُستخدم لعرض الطلبات المعلّقة واعتمادها.
 */
export async function listProducerTickets(): Promise<Ticket[]> {
  if (!(await requireSignedIn())) return []
  const rows = await listTicketsFromDb()
  return rows ?? []
}

/**
 * قائمة تذاكر المستخدم المسجّل حاليًا (Supabase Auth أو الجلسة المحلية).
 * تُستخدم في صفحة «حجوزاتي وتذاكري» للعميل.
 */
export async function getUserTickets(): Promise<Ticket[]> {
  const cookieEmail = await getSessionEmail()
  let email = cookieEmail
  if (!email) {
    const user = await getSupabaseUser()
    email = (user?.email ?? "").trim().toLowerCase()
  }
  if (!email) return []
  const rows = await listTicketsFromDb(email)
  return rows ?? []
}

/** إعادة رفع إيصال تحويل لتذكرة مرفوضة (تُعاد إلى «قيد المراجعة»). */
export async function reuploadTicketReceipt(input: {
  ticketId: string
  receiptUrl: string
  senderPhone?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireSignedIn())) return { ok: false, error: "سجّل الدخول أولًا لإعادة رفع الإيصال." }
  if (!input.receiptUrl.trim()) return { ok: false, error: "أرفق صورة الإيصال أولاً." }
  const ticketId = input.ticketId.trim().toUpperCase()
  const receiptUrl = await resolveReceiptPublicUrl(input.receiptUrl, ticketId)
  const updated = await updateTicketReceiptInDb(
    ticketId,
    receiptUrl ?? null,
    input.senderPhone?.trim() || null,
  )
  return updated ? { ok: true } : { ok: false, error: "تعذّر حفظ الإيصال — حاول مرة أخرى." }
}

/** تحديث حالة تذكرة من لوحة المخرج (اعتماد/رفض إيصال). */
export async function decideTicketByProducer(
  ticketId: string,
  status: Extract<TicketStatus, "approved" | "rejected" | "checked_in">,
): Promise<{ ok: boolean }> {
  if (!(await requireSignedIn())) return { ok: false }
  const updated = await updateTicketStatusInDb(ticketId.trim().toUpperCase(), status)
  return { ok: updated !== null }
}
