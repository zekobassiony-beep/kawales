"use server"

import type { CheckInOutcome, Ticket, TicketStatus } from "@/lib/tickets"
import { checkAdminAccess, getSessionEmail } from "@/lib/auth"
import { getSupabaseUser } from "@/lib/supabase/auth-server"
import {
  checkInTicketInDb,
  getTicketFromDb,
  getTicketStatsFromDb,
  listTicketsFromDb,
  updateTicketReceiptInDb,
  updateTicketStatusInDb,
  upsertTicketInDbDetailed,
  type DbWriteError,
  type TicketStats,
} from "@/lib/supabase/tickets"
import { resolveReceiptPublicUrl, isPublicUrl } from "@/lib/supabase/storage"
import { sendReceiptToTelegram, type ReceiptVerificationInput, type TelegramSendResult } from "@/lib/telegram"
import {
  adminNotifyMode,
  enqueueAdminNotice,
  ensureAdminDigestFlushed,
  escapeTelegramHtml,
  throttleTelegramChat,
} from "@/lib/telegram-throttle"
import { runInBackground } from "@/lib/background"
import { parseTicketCode } from "@/lib/ticket-code"

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

/** يبني سطرًا مختصرًا لحجز واحد يُدرج في رسالة الملخّص الدوري. */
function buildAdminNoticeLine(input: ReceiptVerificationInput): string {
  const seats = input.seatsCount > 0 ? `${input.seatsCount} مقعد` : "بلا مقاعد"
  const amount = `${Math.round(input.totalCents) / 100} ج.م`
  const receiptUrl = input.receiptUrl?.trim()
  const receipt = receiptUrl ? ` · <a href="${escapeTelegramHtml(receiptUrl)}">الإيصال</a>` : ""
  return (
    `<b>${escapeTelegramHtml(input.ticketId)}</b> · ${escapeTelegramHtml(input.showTitle || "عرض")}` +
    ` · ${seats} · ${amount}${receipt}`
  )
}

/**
 * إشعار الإدارة بحجز جديد ويسجّل النتيجة بوضوح (بلا رمي أخطاء أبدًا).
 *
 * **الافتراضي: إشعار كامل فوري لكل حجز** — بطاقة الإيصال وأزرار «قبول/رفض»، وهو
 * أسلوب المنصة في تليجرام ولا يتغيّر إلا بقرار صريح. الملخّص الدوري متاح فقط عند
 * الطلب عبر `TELEGRAM_ADMIN_MODE=digest`، وإعادة الإرسال اليدوي فورية دائمًا.
 */
async function notifyAdmin(
  ticketId: string,
  input: ReceiptVerificationInput,
  options: { instant?: boolean } = {},
): Promise<void> {
  if (adminNotifyMode() === "digest" && !options.instant) {
    enqueueAdminNotice(buildAdminNoticeLine(input))
    // نضمن إرسال الملخّص داخل دورة الطلب نفسها (المؤقّت وحده لا يعيش بعد الاستجابة).
    await runInBackground(async () => {
      await ensureAdminDigestFlushed()
    }, `ملخّص إدارة تليجرام (${ticketId})`)
    return
  }

  // حتى في الإرسال الفوري: تباعد لكل محادثة يمنع تجاوز حدّ تليجرام.
  const chatKey = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "admin"
  const result: TelegramSendResult = await throttleTelegramChat(chatKey, () =>
    sendReceiptToTelegram(input),
  ).catch((error) => ({
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
    // إعادة الإرسال اليدوية تتجاوز التجميع (المشغّل ينتظرها الآن).
    await runInBackground(() => notifyAdmin(id, input, { instant: true }), `إعادة إشعار الإدارة ${id}`)
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

/* ---------- بوابة الدخول: تسجيل الحضور على السيرفر (مصدر الحقيقة) ---------- */

/**
 * نتيجة تسجيل الحضور كما تعرضها شاشة البوابة.
 * `outcome` يحدّد التغذية البصرية/السمعية، و`error` تعني فشلًا تقنيًا
 * (لا حكم على التذكرة) فتسقط الواجهة إلى التخزين المحلي بدل إظهار رفض كاذب.
 */
export type GateCheckInResult = {
  ok: boolean
  outcome: CheckInOutcome
  /** رسالة عربية جاهزة للعرض في الماسح. */
  message: string
  /** التذكرة من قاعدة البيانات (قد تنقص حقول العرض مثل اسم العرض). */
  ticket: Ticket | null
  checkedInAt?: string
  /** سبب تقني عند تعذّر الوصول للقاعدة. */
  error?: string
}

/** ساعة الحضور بتوقيت القاهرة (صيغة مختصرة للعرض في الماسح). */
function formatCheckInClock(value?: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  }).format(date)
}

/**
 * تسجيل حضور تذكرة على السيرفر — **المسار الحقيقي للبوابة**:
 * يقبل حمولة QR الكاملة (`kawalees:ticket:KW-…:…`) أو المعرّف المجرّد،
 * ويُنفّذ تحديثًا محروسًا يمنع استخدام التذكرة مرتين (حتى مع مشغّلين متزامنين).
 * يتطلب جلسة مسجّلة (حساب المسرح/المنظّم) حفاظًا على أمن البوابة.
 */
export async function checkInTicketServer(rawCode: string): Promise<GateCheckInResult> {
  if (!(await requireSignedIn())) {
    return {
      ok: false,
      outcome: "not_found",
      ticket: null,
      message: "سجّل الدخول بحساب المسرح أولًا حتى تُسجَّل عمليات المسح على السيرفر.",
      error: "unauthorized",
    }
  }

  const id = parseTicketCode(rawCode)
  if (!id) {
    return {
      ok: false,
      outcome: "not_found",
      ticket: null,
      message: "الكود المقروء غير صالح — اكتب رقم التذكرة (KW-…) يدويًا.",
      error: "invalid_code",
    }
  }

  // تُسجَّل هوية من نفّذ المسح (تتبّع عمليات البوابة عند وجود أكثر من جهاز).
  const actor = ((await getSessionEmail()) || "غير معروف").trim()

  try {
    const result = await checkInTicketInDb(id)
    console.log(`[tickets] مسح البوابة ${id}: ${result.outcome} — المشغّل: ${actor}`)
    const showLabel = result.ticket?.showTitle?.trim()
    const showSuffix = showLabel ? ` (${showLabel})` : ""
    const clock = formatCheckInClock(result.checkedInAt)

    switch (result.outcome) {
      case "accepted":
        return {
          ok: true,
          outcome: "accepted",
          ticket: result.ticket,
          checkedInAt: result.checkedInAt,
          message: `تم تسجيل الحضور بنجاح${showSuffix} — أهلًا به!`,
        }
      case "already_used":
        return {
          ok: false,
          outcome: "already_used",
          ticket: result.ticket,
          checkedInAt: result.checkedInAt,
          message: clock
            ? `تنبيه: هذه التذكرة مُسجَّلة مسبقًا في تمام الساعة ${clock}.`
            : "تنبيه: هذه التذكرة مُسجَّلة مسبقًا — لا تُقبل مرتين.",
        }
      case "not_verified":
        return {
          ok: false,
          outcome: "not_verified",
          ticket: result.ticket,
          message: "تذكرة غير مقبولة بعد — لم يعتمدها المنظّم حتى الآن.",
        }
      default:
        return {
          ok: false,
          outcome: "not_found",
          ticket: null,
          message: result.error
            ? `تعذّر تسجيل الحضور: ${result.error}`
            : `لا توجد تذكرة بالكود ${id} في المنصة.`,
          ...(result.error ? { error: result.error } : {}),
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[tickets] checkInTicketServer ${id} failed: ${message}`)
    return {
      ok: false,
      outcome: "not_found",
      ticket: null,
      error: message,
      message: `تعذّر الاتصال بقاعدة البيانات (${message}) — أعد المحاولة.`,
    }
  }
}

/* ---------- أرقام اللوحة الإجمالية (بلا تحميل صفوف) ---------- */

/**
 * الأرقام الإجمالية للتذاكر للوحة السوبر أدمن.
 *
 * الغرض: تفصل «الأرقام» عن «القوائم» — القوائم محدودة بأحدث صفوف (حماية النقل)،
 * وهذه الأرقام تُحسب في قاعدة البيانات فتظل دقيقة عند أي عدد تذاكر.
 * تتطلب صلاحية أدمن (نفس بوابة لوحة `/dashboard/admin`).
 */
export async function getTicketStatsServer(): Promise<TicketStats> {
  const access = await checkAdminAccess()
  if (!access.allowed) {
    return {
      source: "unavailable",
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      checkedIn: 0,
      seats: 0,
      revenueCents: 0,
    }
  }
  return getTicketStatsFromDb()
}

