"use server"

import type { Ticket, TicketStatus } from "@/lib/tickets"
import { checkAdminAccess, getSessionEmail } from "@/lib/auth"
import { getSupabaseUser } from "@/lib/supabase/auth-server"
import { listTicketsFromDb, updateTicketReceiptInDb, updateTicketStatusInDb, upsertTicketInDb } from "@/lib/supabase/tickets"
import { resolveReceiptPublicUrl } from "@/lib/supabase/storage"

/**
 * إجراءات الخادم للتذاكر على Supabase — مصدر الحقيقة للوحات التحكم.
 *
 * - `persistTicket`: يحفظ تذكرة كاملة عند إنشاء الحجز (status = pending).
 * - `listMyTickets`: يقرأ تذاكر مستخدم واحد حيًا من الجدول.
 * - `setTicketStatusServer`: يحدّث حالة التذكرة (أزرار قبول/رفض من اللوحات إن لزم).
 */

export async function persistTicket(ticket: Ticket): Promise<{ ok: boolean }> {
  try {
    // رفع صورة الإيصال إلى Supabase Storage وحفظ رابطها العام في `receipt_url`.
    const receiptImage = await resolveReceiptPublicUrl(ticket.receiptImage, ticket.id)
    const saved = await upsertTicketInDb({ ...ticket, receiptImage })
    return { ok: saved !== null }
  } catch (error) {
    console.error(`[tickets] persistTicket ${ticket.id} failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
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
