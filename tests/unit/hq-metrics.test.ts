import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cityFromVenueLabel,
  computeHqMetrics,
  formatCompact,
  formatEgpFromCents,
  isRevenueStatus,
  type HQEventInput,
} from "../../lib/hq-metrics"
import { hqOpsStats, seedHqOps } from "../../lib/hq-ops"

const NOW = new Date("2026-06-15T12:00:00.000Z")

function event(overrides: Partial<HQEventInput> = {}): HQEventInput {
  return {
    id: 1,
    title: "ليلة في القهوة",
    status: "on_sale",
    startsAtIso: "2026-07-01T19:00:00.000Z",
    city: "القاهرة",
    venueName: "مسرح الأندلس",
    venueCapacity: 100,
    minPriceCents: 15000,
    ...overrides,
  }
}

function ticket(overrides: Partial<{ totalCents: number; status: string; createdAt: string; venue: string; showTitle: string; seats: string[] }> = {}) {
  return {
    totalCents: 30000,
    status: "approved",
    createdAt: "2026-06-02T10:00:00.000Z",
    venue: "مسرح الأندلس، القاهرة",
    showTitle: "ليلة في القهوة",
    seats: ["A1", "A2"],
    ...overrides,
  }
}

describe("مقاييس لوحة السوبر أدمن (HQ)", () => {
  it("يحسب الإيراد من التذاكر المعتمدة/الحاضرة فقط", () => {
    const metrics = computeHqMetrics({
      events: [event()],
      tickets: [
        ticket({ totalCents: 30000, status: "approved" }),
        ticket({ totalCents: 20000, status: "checked_in" }),
        ticket({ totalCents: 99999, status: "pending" }),
        ticket({ totalCents: 88888, status: "rejected" }),
      ],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(metrics.revenueCents, 50000)
    assert.equal(metrics.ticketsSold, 2)
  })

  it("يعدّ العروض الشغّالة والمسارح والفرق", () => {
    const metrics = computeHqMetrics({
      events: [
        event(),
        event({ id: 2, venueName: "مسرح الطليعة", title: "ظل الحكاية" }),
        // عرض مغلق لا يُحسب ضمن الشغّال.
        event({ id: 3, status: "closed", venueName: "مسرح الطليعة" }),
      ],
      tickets: [],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(metrics.runningShows, 2)
    assert.equal(metrics.venues, 2)
    assert.equal(metrics.troupes, 2)
  })

  it("يجمع الطلبات العاجلة من الانضمام والسحب والبلاغات", () => {
    const metrics = computeHqMetrics({
      events: [],
      tickets: [],
      ops: {
        joinRequests: [{ status: "pending" }, { status: "pending" }, { status: "approved" }],
        payouts: [{ status: "pending" }, { status: "on_hold" }],
        alerts: [{ status: "open" }, { status: "resolved" }],
      },
      now: NOW,
    })
    assert.equal(metrics.urgentActions, 4)
  })

  it("يوزّع الإيراد على المدن ويعرض الأعلى فقط", () => {
    const metrics = computeHqMetrics({
      events: [event()],
      tickets: [
        ticket({ venue: "مسرح الأندلس، القاهرة", totalCents: 50000 }),
        ticket({ venue: "مسرح الطليعة، الإسكندرية", totalCents: 20000 }),
        ticket({ venue: "مسرح الأندلس، القاهرة", totalCents: 10000 }),
      ],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(metrics.revenueByCity[0]?.label, "القاهرة")
    assert.equal(metrics.revenueByCity[0]?.value, 60000)
    assert.equal(metrics.revenueByCity[1]?.label, "الإسكندرية")
  })

  it("يحسب إشغال المسارح من السعة والمباع", () => {
    const metrics = computeHqMetrics({
      events: [event({ venueCapacity: 100 })],
      tickets: [ticket({ seats: ["A1", "A2", "A3"] })],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(metrics.occupancy[0]?.sold, 3)
    assert.equal(metrics.occupancy[0]?.capacity, 100)
  })

  it("يستخدم منحنى توضيحيًا فقط عند قلّة البيانات", () => {
    const sparse = computeHqMetrics({
      events: [],
      tickets: [ticket()],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(sparse.trendIsDemo, true)
    assert.equal(sparse.revenueTrend.length, 6)

    const rich = computeHqMetrics({
      events: [],
      tickets: [ticket(), ticket(), ticket()],
      ops: { joinRequests: [], payouts: [], alerts: [] },
      now: NOW,
    })
    assert.equal(rich.trendIsDemo, false)
  })
})

describe("مساعدات التنسيق", () => {
  it("يستخرج المدينة من وصف المكان", () => {
    assert.equal(cityFromVenueLabel("مسرح الأندلس، القاهرة"), "القاهرة")
    assert.equal(cityFromVenueLabel("مسرح الحر, الإسكندرية"), "الإسكندرية")
    assert.equal(cityFromVenueLabel("بدون مدينة"), "غير محدد")
  })

  it("يميّز حالات الإيراد", () => {
    assert.equal(isRevenueStatus("approved"), true)
    assert.equal(isRevenueStatus("checked_in"), true)
    assert.equal(isRevenueStatus("pending"), false)
    assert.equal(isRevenueStatus("rejected"), false)
  })

  it("ينسّق الأرقام والإيراد", () => {
    assert.equal(formatCompact(950), "950")
    assert.equal(formatCompact(24_500), "24.5K")
    assert.equal(formatCompact(2_400_000), "2.4M")
    // التنسيق يتبع لغة الواجهة (ar-EG) لذا نقارن بنفس المُنسّق.
    assert.equal(formatEgpFromCents(50_000), `${(500).toLocaleString("ar-EG")} ج.م`)
  })
})

describe("عمليات HQ (مخزن القرارات)", () => {
  it("يحصي المعلّقات من البيانات الأولية", () => {
    const stats = hqOpsStats(seedHqOps())
    assert.equal(stats.pendingJoins, 2)
    assert.equal(stats.pendingPayouts, 2)
    assert.equal(stats.openAlerts, 3)
    assert.equal(stats.urgentTotal, 7)
    assert.equal(stats.pendingPayoutCents, 1_250_000 + 860_000)
  })

  it("يتعامل مع حالة فارغة بلا أخطاء", () => {
    const stats = hqOpsStats({ joinRequests: [], payouts: [], alerts: [] })
    assert.equal(stats.urgentTotal, 0)
    assert.equal(stats.pendingPayoutCents, 0)
  })
})
