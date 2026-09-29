/**
 * قواعد **متى** نستطلع حالة التذاكر من السيرفر (وحدة نقية قابلة للاختبار).
 *
 * الفكرة: كل نبضة استطلاع = نداء دالة + استعلام قاعدة بيانات + نقل بيانات، ولا
 * معنى لها إن لم يكن هناك ما ينتظره المستخدم. فنجعلها مشروطة وقابلة للتوقف:
 * تنتظر **قرارًا** (تذكرة معلّقة) أو **بطاقة تذكرة** (مقبولة بلا صورة بعد).
 */

/** الفاصل الأولي بين النبضات (أسرع لحظةِ انتظار قرار). */
export const POLL_BASE_MS = 6000

/** سقف الفاصل بعد التباعد التدريجي. */
export const POLL_MAX_MS = 30000

/** أقصى مدة استطلاع كاملة قبل الاعتماد على التحديث اليدوي. */
export const POLL_WINDOW_MS = 15 * 60 * 1000

/** الحد الأدنى المطلوب من التذكرة للحكم عليها (تجنّب اعتماد على نوع ثقيل). */
type PollableTicket = { status: string; ticketImageUrl?: string }

/** حالات القبول (نفس مرادفات `normalizeTicketStatus`). */
const APPROVED_STATUSES = new Set(["approved", "active", "confirmed", "paid", "completed"])

/** يوحّد الحالة كما تفعل `normalizeTicketStatus` (نسخة مصغّرة نقية). */
export function isAcceptedStatus(status: string): boolean {
  return APPROVED_STATUSES.has((status ?? "").trim().toLowerCase())
}

/** هل هذه التذكرة تنتظر شيئًا من السيرفر؟ */
export function ticketNeedsServerSync(ticket: PollableTicket): boolean {
  const status = (ticket.status ?? "").trim().toLowerCase()
  if (status === "pending") return true
  return isAcceptedStatus(status) && !ticket.ticketImageUrl
}

/** هل تستحق هذه القائمة استطلاعًا الآن؟ */
export function shouldPollTickets(tickets: readonly PollableTicket[]): boolean {
  return tickets.some(ticketNeedsServerSync)
}
