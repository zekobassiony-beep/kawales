/**
 * مساعدات «الممر الرقمي للتذكرة» (وحدة **نقية** قابلة للاختبار):
 * شارات الحالة، تصفية التبويبات، الإحصائيات، الفئة المعدنية، رابط الإهداء،
 * وسياسة الحضور المعروضة في التذكرة المطبوعة.
 */

import type { Ticket } from "@/lib/tickets"

export type PassTone = "green" | "amber" | "red" | "gray" | "gold"

export type PassStatusMeta = {
  label: string
  tone: PassTone
  /** هل التذكرة جاهزة للدخول (تُظهر QR فعّالًا)؟ */
  admitted: boolean
}

/** شارة الحالة المضيئة لكل حالة تذكرة. */
export function passStatus(status: string): PassStatusMeta {
  switch (status) {
    case "approved":
      return { label: "معتمدة وجاهزة ✅", tone: "green", admitted: true }
    case "checked_in":
      return { label: "تم استخدامها/حضر 🎭", tone: "gold", admitted: true }
    case "rejected":
      return { label: "إيصال مرفوض ✖", tone: "red", admitted: false }
    default:
      return { label: "قيد مراجعة الإيصال ⏳", tone: "amber", admitted: false }
  }
}

export type PassTab = "upcoming" | "past" | "pending"

/** يوزّع تذاكر المستخدم على تبويبات الصفحة الثلاثة. */
export function splitByTab(tickets: Ticket[], now: Date = new Date()): Record<PassTab, Ticket[]> {
  const buckets: Record<PassTab, Ticket[]> = { upcoming: [], past: [], pending: [] }
  const nowTime = now.getTime()

  for (const ticket of tickets) {
    if (ticket.status === "pending" || ticket.status === "rejected") {
      buckets.pending.push(ticket)
      continue
    }
    const startsAt = new Date(ticket.startsAtIso ?? ticket.startsAt).getTime()
    const isUpcoming = Number.isNaN(startsAt) ? true : startsAt >= nowTime
    if (isUpcoming && ticket.status !== "checked_in") buckets.upcoming.push(ticket)
    else buckets.past.push(ticket)
  }

  const byDate = (direction: 1 | -1) => (a: Ticket, b: Ticket) =>
    direction *
    (new Date(a.startsAtIso ?? a.startsAt).getTime() - new Date(b.startsAtIso ?? b.startsAt).getTime())

  buckets.upcoming.sort(byDate(1))
  buckets.past.sort(byDate(-1))
  return buckets
}

/** إحصائيات العميل الثلاثة أعلى الصفحة. */
export function passStats(tickets: Ticket[], now: Date = new Date()): {
  activeUpcoming: number
  attended: number
  pending: number
} {
  const buckets = splitByTab(tickets, now)
  return {
    activeUpcoming: buckets.upcoming.filter((ticket) => ticket.status === "approved").length,
    attended: tickets.filter((ticket) => ticket.status === "checked_in").length,
    pending: buckets.pending.length,
  }
}

/** الاسم المعدني للفئة (دايموند/ذهبي/فضي/برونزي) — يعتمد سعر المقعد الواحد. */
export function tierMetal(name: string, unitCents: number, allUnitPrices: number[]): string {
  if (/vip|دايموند/i.test(name)) return "دايموند"
  const sorted = [...new Set(allUnitPrices)].sort((a, b) => b - a)
  const index = Math.max(0, sorted.indexOf(unitCents))
  const metals = ["دايموند", "ذهبي", "فضي", "برونزي"]
  return metals[Math.min(index, metals.length - 1)]
}

/** رابط إهداء/نقل التذكرة لصديق (رابط مشاركة ناعم). */
export function giftLink(ticketId: string, origin = ""): string {
  const base = origin.replace(/\/$/, "")
  return `${base}/dashboard/tickets?gift=${encodeURIComponent(ticketId)}`
}

/** نص رسالة الإهداء الجاهزة للمشاركة. */
export function giftMessage(ticket: Ticket): string {
  return `🎁 إهداء تذكرة: ${ticket.showTitle} — ${ticket.venue} (${ticket.startsAt}). كود التذكرة ${ticket.id}. افتحها من كواليس.`
}

/** رابط اللوكيشن: رابط المسرح المحفوظ أو بحث Google Maps تلقائي. */
export function passMapsUrl(venueLabel: string, googleMapsUrl?: string | null): string {
  const stored = (googleMapsUrl ?? "").trim()
  if (stored.length > 0) return stored
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLabel)}`
}

/** سياسة الحضور وتعليمات المسرح المعروضة في التذكرة المطبوعة. */
export const ATTENDANCE_POLICY = [
  "الحضور قبل موعد العرض بـ 30 دقيقة على الأقل لتسجيل الدخول عند البوابة.",
  "ممنوع التصوير أو التسجيل داخل القاعة حفاظًا على حقوق الفرقة.",
  "التذكرة صالحة لمرة واحدة فقط وتُلغى بعد مسح رمز QR.",
  "الالتزام بالتصنيف العمري المعلن للعرض.",
  "في حال التأخير: يُسمح بالدخول بين الفواصل فقط.",
]
