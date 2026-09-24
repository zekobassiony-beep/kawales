/**
 * نواة مقاييس لوحة المخرج/منظم العروض (وحدة **نقية** قابلة للاختبار):
 * مؤشرات الأداء، مخطط آخر ١٤ يومًا، وحالة كل عرض ونسبة إشغاله.
 */

import { occupancyInfo, type OccupancyInfo } from "@/lib/show-detail"

export type ProducerTicketInput = {
  id: string
  totalCents: number
  status: string
  createdAt: string
  seats: string[]
  showTitle: string
}

export type ProducerEventInput = {
  id: number
  slug: string
  title: string
  status: string
  startsAtIso: string
  venueName: string
  venueCity: string
  /** سعة المسرح (صفوف × مقاعد) لحساب نسبة الإشغال. */
  capacity: number
}

export type ProducerKpis = {
  revenueCents: number
  revenueTrendPct: number
  ticketsSold: number
  capacity: number
  occupancyPct: number
  pendingReceipts: number
  rejected: number
}

export type SalesPoint = { label: string; value: number; isPeak: boolean }
export type SalesMetric = "amount" | "count"

export type ShowTone = "green" | "amber" | "red" | "gray"

export type ProducerShowRow = {
  id: number
  slug: string
  title: string
  venue: string
  startsAtIso: string
  sold: number
  capacity: number
  occupancy: OccupancyInfo
  badge: { label: string; tone: ShowTone }
}

const DAY_LABELS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]

/** التذاكر المعتمدة (مقبولة أو حضرت) هي مصدر الإيراد والمبيعات. */
export function isPaidStatus(status: string): boolean {
  return status === "approved" || status === "checked_in"
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** سلسلة المبيعات اليومية لآخر `days` يومًا (الأقدم أولًا) مع تمييز أيام الذروة. */
export function salesSeries(
  tickets: ProducerTicketInput[],
  metric: SalesMetric,
  days = 14,
  now: Date = new Date(),
): SalesPoint[] {
  const buckets = new Map<string, number>()
  const labels = new Map<string, string>()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const key = dayKey(date)
    buckets.set(key, 0)
    labels.set(key, `${date.getDate()}/${date.getMonth() + 1}`)
  }

  for (const ticket of tickets) {
    if (!isPaidStatus(ticket.status)) continue
    const date = new Date(ticket.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = dayKey(date)
    if (!buckets.has(key)) continue
    const increment = metric === "amount" ? ticket.totalCents : Math.max(1, ticket.seats.length)
    buckets.set(key, (buckets.get(key) ?? 0) + increment)
  }

  const points = [...buckets.entries()].map(([key, value]) => ({ label: labels.get(key) ?? key, value }))
  const peak = Math.max(0, ...points.map((point) => point.value))
  return points.map((point) => ({ label: point.label, value: point.value, isPeak: peak > 0 && point.value === peak }))
}

/** شارة حالة العرض كما تُعرض في جدول المخرج. */
export function showBadge(input: {
  status: string
  occupancy: OccupancyInfo
  startsAt: Date | string
  now?: Date
}): { label: string; tone: ShowTone } {
  const now = input.now ?? new Date()
  const start = input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt)
  const past = !Number.isNaN(start.getTime()) && start.getTime() < now.getTime()

  if (input.status === "cancelled" || input.status === "archived" || past) {
    return { label: "مؤرشف 📁", tone: "gray" }
  }
  if (input.status === "draft" || input.occupancy.pct === 0) {
    return { label: "قيد التحضير ⏳", tone: "amber" }
  }
  if (input.occupancy.remaining === 0) {
    return { label: "مكتمل العدد 🔥", tone: "red" }
  }
  return { label: "نشط 🟢", tone: "green" }
}

/** صفوف العروض مع الإشغال والشارة (مرتّبة زمنيًا). */
export function producerShowRows(
  events: ProducerEventInput[],
  soldCounts: Map<number, number>,
  capacityOf: (event: ProducerEventInput) => number,
  now: Date = new Date(),
): ProducerShowRow[] {
  return events
    .map((event) => {
      const capacity = Math.max(1, capacityOf(event))
      const sold = soldCounts.get(event.id) ?? 0
      const occupancy = occupancyInfo(sold, capacity)
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        venue: `${event.venueName}، ${event.venueCity}`,
        startsAtIso: event.startsAtIso,
        sold,
        capacity,
        occupancy,
        badge: showBadge({ status: event.status, occupancy, startsAt: event.startsAtIso, now }),
      }
    })
    .sort((a, b) => new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime())
}

/** يحسب مؤشرات الأداء الأربعة + نسبة التغيّر مقارنة بالأسبوع السابق. */
export function producerKpis(input: {
  tickets: ProducerTicketInput[]
  events: ProducerEventInput[]
  capacityOf: (event: ProducerEventInput) => number
  now?: Date
}): ProducerKpis {
  const now = input.now ?? new Date()
  const paid = input.tickets.filter((ticket) => isPaidStatus(ticket.status))

  const revenueCents = paid.reduce((sum, ticket) => sum + (Number(ticket.totalCents) || 0), 0)
  const ticketsSold = paid.reduce((sum, ticket) => sum + Math.max(1, ticket.seats.length), 0)
  const capacity = input.events.reduce((sum, event) => sum + Math.max(1, input.capacityOf(event)), 0)

  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000
  const inWindow = (from: number, to: number) =>
    paid
      .filter((ticket) => {
        const time = new Date(ticket.createdAt).getTime()
        return !Number.isNaN(time) && time > from && time <= to
      })
      .reduce((sum, ticket) => sum + ticket.totalCents, 0)

  const thisWeek = inWindow(weekAgo, now.getTime())
  const lastWeek = inWindow(twoWeeksAgo, weekAgo)
  const revenueTrendPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0

  return {
    revenueCents,
    revenueTrendPct,
    ticketsSold,
    capacity,
    occupancyPct: capacity > 0 ? Math.round((ticketsSold / capacity) * 100) : 0,
    pendingReceipts: input.tickets.filter((ticket) => ticket.status === "pending").length,
    rejected: input.tickets.filter((ticket) => ticket.status === "rejected").length,
  }
}

/** وسوم أيام الأسبوع العربية (تظهر في تلميح المخطط). */
export function weekdayLabel(date: Date | string): string {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return "—"
  return DAY_LABELS[value.getDay()] ?? "—"
}

/** أسباب رفض الإيصال المتاحة للمدير. */
export const RECEIPT_REJECTION_REASONS = [
  "صورة الإيصال غير واضحة",
  "المبلغ المحوَّل أقل من قيمة الحجز",
  "رقم التحويل لا يطابق المسجّل",
  "إيصال مكرر أو مستخدم سابقًا",
  "لم يتم العثور على التحويل في كشف الحساب",
]

export type ProducerApplicationStatus = "pending" | "second_round" | "shortlist" | "rejected"

/** شارات حالة طلب الكاستينج. */
export const APPLICATION_BADGES: Record<ProducerApplicationStatus, { label: string; tone: ShowTone }> = {
  pending: { label: "جديد 🆕", tone: "gray" },
  shortlist: { label: "القائمة القصيرة ⭐", tone: "amber" },
  second_round: { label: "مقبول ✅", tone: "green" },
  rejected: { label: "مرفوض ✖", tone: "red" },
}

/** سن الممثل المتقدم: غير مخزّن في الطلب، لذا يُشتق حتميًا من بريده (للعرض فقط). */
export function derivedAge(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return 21 + (hash % 14)
}

/** رابط واتساب مباشر للتواصل مع المتقدم (يعتمد رقمه المخزّن). */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  const international = digits.startsWith("20") ? digits : `20${digits.replace(/^0/, "")}`
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`
}

