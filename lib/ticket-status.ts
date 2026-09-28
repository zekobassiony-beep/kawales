/**
 * توحيد فحص حالات التذاكر في كل الواجهات والسيرفر.
 *
 * الحالة تُكتب من أكثر من مصدر (بوت تليجرام، بوابة الدفع، لوحات الإدارة، مخزون قديم)،
 * فقد تصل بصيغ مختلفة لنفس المعنى: `approved` / `ACTIVE` / `CONFIRMED` …
 * لذلك نُطبّع كل قيمة إلى واحدة من أربع حالات معتمدة قبل أي فحص أو عرض.
 *
 * ملف بيانات صرف بلا اعتماد على السيرفر أو المتصفح (يُستورد من الوسيط والواجهات معًا).
 */

export const TICKET_STATUSES = ["pending", "approved", "rejected", "checked_in"] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "قيد مراجعة الإيصال",
  approved: "مقبول — QR فعّال",
  rejected: "مرفوض",
  checked_in: "تم الحضور — مسحت عند البوابة",
}

/** مرادفات الحالة «المقبولة» القادمة من مصادر أخرى. */
const ACCEPTED_ALIASES = [
  "approved",
  "approve",
  "active",
  "confirmed",
  "confirm",
  "paid",
  "complete",
  "completed",
  "valid",
  "accepted",
  "success",
  "succeeded",
]

/** مرادفات الحضور المسجَّل عند البوابة. */
const CHECKED_IN_ALIASES = ["checked_in", "checkedin", "used", "attended", "scanned", "redeemed", "admitted"]

/** مرادفات الرفض. */
const REJECTED_ALIASES = [
  "rejected",
  "reject",
  "declined",
  "refused",
  "cancelled",
  "canceled",
  "failed",
  "void",
  "expired",
]

/** يُطبّع أي قيمة حالة إلى الحالات الأربع المعتمدة (الافتراضي «قيد المراجعة»). */
export function normalizeTicketStatus(value: unknown): TicketStatus {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (CHECKED_IN_ALIASES.includes(raw)) return "checked_in"
  if (ACCEPTED_ALIASES.includes(raw)) return "approved"
  if (REJECTED_ALIASES.includes(raw)) return "rejected"
  return "pending"
}

/** هل التذكرة مقبولة (approved / ACTIVE / confirmed / تم الحضور)؟ */
export function isTicketAccepted(status: unknown): boolean {
  const normalized = normalizeTicketStatus(status)
  return normalized === "approved" || normalized === "checked_in"
}

/** هل التذكرة ما زالت بانتظار مراجعة الإيصال؟ */
export function isTicketPending(status: unknown): boolean {
  return normalizeTicketStatus(status) === "pending"
}

/** هل رُفض الإيصال؟ */
export function isTicketRejected(status: unknown): boolean {
  return normalizeTicketStatus(status) === "rejected"
}

/** تسمية الحالة للعرض (تفهم كل المرادفات). */
export function ticketStatusLabel(status: unknown): string {
  return TICKET_STATUS_LABELS[normalizeTicketStatus(status)]
}

/** لون شارة الحالة (يوافق `StatusBadge` في لوحات التحكم). */
export function ticketStatusTone(status: unknown): "green" | "amber" | "red" | "gray" {
  const normalized = normalizeTicketStatus(status)
  if (normalized === "approved" || normalized === "checked_in") return "green"
  if (normalized === "rejected") return "red"
  return "amber"
}
