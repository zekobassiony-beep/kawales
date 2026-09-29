/**
 * نواة مقاييس لوحة السوبر أدمن (HQ) — وحدة **نقية** بلا أي اعتماد على المتصفح
 * أو السيرفر، لذا تُختبر وحديًا وتُستخدم في مكوّنات العميل.
 */

export type HQEventInput = {
  id: number
  title: string
  status: string
  startsAtIso: string
  city: string
  venueName: string
  venueCapacity: number
  /** عدد المقاعد المباعة فعليًا لهذا العرض (من جدول الحجوزات — مصدر الحقيقة). */
  soldSeats: number
  minPriceCents: number
}

export type HQTicketInput = {
  totalCents: number
  status: string
  createdAt: string
  venue: string
  showTitle: string
  seats: string[]
}

export type HQOpsInput = {
  joinRequests: { status: string }[]
  payouts: { status: string }[]
  alerts: { status: string }[]
}

export type HQPoint = { label: string; value: number }
export type HQOccupancyPoint = {
  label: string
  sold: number
  capacity: number
  /** المقاعد المتبقية فعليًا (السعة − المباع). */
  remaining: number
  /** نسبة الإشغال (%). */
  pct: number
}

export type HQMetrics = {
  /** إجمالي الإيرادات المعتمدة (بالقروش) من التذاكر المقبولة/الحضور. */
  revenueCents: number
  /** نسبة النمو مقارنة بالشهر السابق (%). */
  revenueGrowthPct: number
  /** سلسلة الإيرادات آخر ٦ أشهر. */
  revenueTrend: HQPoint[]
  /** هل السلسلة بيانات حقيقية أم توضيحية (قاعدة البيانات فارغة). */
  trendIsDemo: boolean
  /** عدد العروض الشغّالة الآن. */
  runningShows: number
  /** إجمالي المسارح (فريدة) والفرق (فريدة). */
  venues: number
  troupes: number
  /** إجمالي التذاكر المباعة (مقبولة + حضور). */
  ticketsSold: number
  /** الطلبات التي تتطلب إجراءً عاجلًا. */
  urgentActions: number
  /** الإيراد حسب المحافظة/المدينة (أعلى ٥). */
  revenueByCity: HQPoint[]
  /** العروض الأكثر مبيعًا (أعلى ٥). */
  topShows: HQPoint[]
  /** نسب إشغال المسارح (أعلى ٤). */
  occupancy: HQOccupancyPoint[]
  /** إجمالي سعة كل العروض (مجموع سعة كل عرض على حدة). */
  capacityTotal: number
  /** إجمالي المقاعد المباعة عبر كل العروض. */
  soldTotal: number
  /** إجمالي المقاعد المتبقية عبر كل العروض. */
  seatsRemaining: number
  /** نسبة الإشغال الكلية (%). */
  occupancyPct: number
}

const MONTH_LABELS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
]

/** الإيراد يُحسب من التذاكر المقبولة أو التي حضرت فعلًا. */
export function isRevenueStatus(status: string): boolean {
  return status === "approved" || status === "checked_in"
}

/** يستخرج المدينة من وصف مكان التذكرة («اسم المسرح، المدينة»). */
export function cityFromVenueLabel(label: string): string {
  const parts = (label ?? "").split(/[،,]/)
  const city = parts.length > 1 ? parts[parts.length - 1].trim() : ""
  return city.length > 0 ? city : "غير محدد"
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** آخر `count` أشهر (الأقدم أولًا) بمعرّفات وملصقات عربية. */
function lastMonths(count: number, now: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    months.push({ key: monthKey(date), label: MONTH_LABELS[date.getMonth()] })
  }
  return months
}

function topEntries(map: Map<string, number>, limit: number): HQPoint[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
}

/** تنسيق مختصر للأرقام الكبيرة (٢٤٥٠٠ → 24.5K). */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

/** تنسيق الإيراد بالجنيه من القروش. */
export function formatEgpFromCents(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("ar-EG")} ج.م`
}

/**
 * يحسب كل مؤشرات لوحة السوبر أدمن من البيانات المتاحة:
 * العروض (قاعدة البيانات/البيانات الافتراضية) + التذاكر (Supabase/المحلي) + طلبات العمليات.
 */
export function computeHqMetrics(input: {
  events: HQEventInput[]
  tickets: HQTicketInput[]
  ops: HQOpsInput
  now?: Date
}): HQMetrics {
  const now = input.now ?? new Date()
  const paidTickets = input.tickets.filter((ticket) => isRevenueStatus(ticket.status))
  const revenueCents = paidTickets.reduce((sum, ticket) => sum + (Number(ticket.totalCents) || 0), 0)

  // سلسلة الإيرادات آخر ٦ أشهر من التذاكر الحقيقية.
  const months = lastMonths(6, now)
  const buckets = new Map<string, number>(months.map((month) => [month.key, 0]))
  for (const ticket of paidTickets) {
    const date = new Date(ticket.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = monthKey(date)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + ticket.totalCents)
  }
  const hasRealTrend = paidTickets.length >= 3
  const revenueTrend: HQPoint[] = months.map((month, index) => ({
    label: month.label,
    // عند غياب بيانات كافية نعرض منحنى توضيحيًا تصاعديًا ليبقى الرسم مفيدًا بصريًا.
    value: hasRealTrend
      ? (buckets.get(month.key) ?? 0)
      : Math.round((revenueCents || 480000) * (0.45 + index * 0.11)),
  }))

  const currentMonthValue = revenueTrend[revenueTrend.length - 1]?.value ?? 0
  const previousMonthValue = revenueTrend[revenueTrend.length - 2]?.value ?? 0
  const revenueGrowthPct =
    previousMonthValue > 0
      ? Math.round(((currentMonthValue - previousMonthValue) / previousMonthValue) * 100)
      : currentMonthValue > 0
        ? 100
        : 0

  const runningShows = input.events.filter(
    (event) =>
      event.status === "on_sale" && new Date(event.startsAtIso).getTime() >= now.getTime() - 1000 * 60 * 60 * 24,
  ).length

  const cityTotals = new Map<string, number>()
  const showTotals = new Map<string, number>()
  const soldByVenue = new Map<string, number>()
  for (const ticket of paidTickets) {
    const city = cityFromVenueLabel(ticket.venue)
    cityTotals.set(city, (cityTotals.get(city) ?? 0) + ticket.totalCents)

    const show = ticket.showTitle?.trim() || "غير محدد"
    showTotals.set(show, (showTotals.get(show) ?? 0) + Math.max(1, ticket.seats.length))

    const venueName = ticket.venue.split(/[،,]/)[0]?.trim() || "غير محدد"
    soldByVenue.set(venueName, (soldByVenue.get(venueName) ?? 0) + Math.max(1, ticket.seats.length))
  }

  // إشغال المسارح: يُحسب من **المقاعد المباعة الحقيقية** لكل عرض (مصدر الحقيقة في
  // جدول الحجوزات)، مع الاستعانة بعدد مقاعد التذاكر كحد أدنى احتياطي عند غياب البيانات.
  const capacityTotal = input.events.reduce((sum, event) => sum + Math.max(1, event.venueCapacity), 0)
  const soldTotal = input.events.reduce(
    (sum, event) => sum + Math.max(0, Math.min(event.soldSeats ?? 0, Math.max(1, event.venueCapacity))),
    0,
  )
  const seatsRemaining = Math.max(0, capacityTotal - soldTotal)
  const occupancyPct = capacityTotal > 0 ? Math.round((soldTotal / capacityTotal) * 100) : 0

  const occupancy: HQOccupancyPoint[] = input.events
    .reduce<HQOccupancyPoint[]>((list, event) => {
      if (!list.some((item) => item.label === event.venueName)) {
        const capacity = Math.max(1, event.venueCapacity)
        // المباع الحقيقي لهذا العرض، وإن كان صفرًا نستعين بمقاعد التذاكر لنفس المسرح.
        const soldFromEvents = Math.max(0, Math.min(event.soldSeats ?? 0, capacity))
        const soldFromTickets = soldByVenue.get(event.venueName) ?? 0
        const sold = Math.max(soldFromEvents, soldFromTickets)
        list.push({
          label: event.venueName,
          sold,
          capacity,
          remaining: Math.max(0, capacity - sold),
          pct: Math.round((Math.min(sold, capacity) / capacity) * 100),
        })
      }
      return list
    }, [])
    .sort((a, b) => b.pct - a.pct || b.sold - a.sold)
    .slice(0, 4)

  const venueNames = new Set(input.events.map((event) => event.venueName).filter(Boolean))
  const troupeKeys = new Set(
    input.events.map((event) => event.title.split("—")[0]?.trim()).filter(Boolean) as string[],
  )

  const urgentActions =
    input.ops.joinRequests.filter((item) => item.status === "pending").length +
    input.ops.payouts.filter((item) => item.status === "pending").length +
    input.ops.alerts.filter((item) => item.status === "open").length

  return {
    revenueCents,
    revenueGrowthPct,
    revenueTrend,
    trendIsDemo: !hasRealTrend,
    runningShows,
    venues: venueNames.size,
    troupes: troupeKeys.size,
    ticketsSold: paidTickets.length,
    urgentActions,
    revenueByCity: topEntries(cityTotals, 5),
    topShows: topEntries(showTotals, 5),
    occupancy,
    capacityTotal,
    soldTotal,
    seatsRemaining,
    occupancyPct,
  }
}

