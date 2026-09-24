import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  APPLICATION_BADGES,
  derivedAge,
  isPaidStatus,
  producerKpis,
  producerShowRows,
  salesSeries,
  showBadge,
  whatsappLink,
  type ProducerEventInput,
} from "../../lib/producer-metrics"
import { occupancyInfo } from "../../lib/show-detail"

const NOW = new Date("2026-06-20T12:00:00")

function ticket(overrides: Partial<{ totalCents: number; status: string; createdAt: string; seats: string[] }> = {}) {
  return {
    id: "KW-1",
    totalCents: 30000,
    status: "approved",
    createdAt: "2026-06-19T10:00:00",
    seats: ["A1", "A2"],
    showTitle: "ليلة في القهوة",
    ...overrides,
  }
}

function event(overrides: Partial<ProducerEventInput> = {}): ProducerEventInput {
  return {
    id: 1,
    slug: "night-at-the-qahwa",
    title: "ليلة في القهوة",
    status: "on_sale",
    startsAtIso: "2026-07-01T19:00:00+02:00",
    venueName: "مسرح الهوسابير",
    venueCity: "القاهرة",
    capacity: 96,
    ...overrides,
  }
}

describe("مؤشرات لوحة المخرج", () => {
  it("يحسب الإيراد والمبيعات والسعة ومتوسط الإشغال", () => {
    const kpis = producerKpis({
      tickets: [
        ticket({ totalCents: 30000, status: "approved" }),
        ticket({ totalCents: 20000, status: "checked_in", seats: ["B1"] }),
        ticket({ totalCents: 99999, status: "pending", seats: ["C1"] }),
      ],
      events: [event({ capacity: 96 })],
      capacityOf: (item) => item.capacity,
      now: NOW,
    })
    assert.equal(kpis.revenueCents, 50000)
    assert.equal(kpis.ticketsSold, 3)
    assert.equal(kpis.capacity, 96)
    assert.equal(kpis.occupancyPct, 3)
    assert.equal(kpis.pendingReceipts, 1)
  })

  it("يقيس تغيّر الإيراد بين الأسبوعين الأخيرين", () => {
    const kpis = producerKpis({
      tickets: [
        ticket({ totalCents: 10000, createdAt: "2026-06-19T10:00:00" }),
        ticket({ totalCents: 5000, createdAt: "2026-06-11T10:00:00" }),
      ],
      events: [],
      capacityOf: (item) => item.capacity,
      now: NOW,
    })
    assert.equal(kpis.revenueTrendPct, 100)
  })

  it("يميّز حالات الدفع المعتمدة فقط", () => {
    assert.equal(isPaidStatus("approved"), true)
    assert.equal(isPaidStatus("checked_in"), true)
    assert.equal(isPaidStatus("pending"), false)
    assert.equal(isPaidStatus("rejected"), false)
  })
})

describe("مخطط آخر ١٤ يومًا", () => {
  it("يبني ١٤ نقطة ويرصد أيام الذروة بالمبالغ", () => {
    const series = salesSeries(
      [
        ticket({ totalCents: 30000, createdAt: "2026-06-19T10:00:00" }),
        ticket({ totalCents: 10000, createdAt: "2026-06-19T11:00:00" }),
        ticket({ totalCents: 5000, createdAt: "2026-06-15T10:00:00" }),
      ],
      "amount",
      14,
      NOW,
    )
    assert.equal(series.length, 14)
    // آخر نقطة = يوم «الآن»، وتذاكر اليوم السابق في النقطة التي قبلها.
    assert.equal(series[series.length - 2].value, 40000)
    assert.equal(series[series.length - 2].isPeak, true)
    assert.equal(series.filter((point) => point.isPeak).length, 1)
  })

  it("يبدّل بين العدّ والمبالغ ويتجاهل غير المعتمد", () => {
    const series = salesSeries(
      [
        ticket({ totalCents: 30000, seats: ["A1", "A2"], createdAt: "2026-06-19T10:00:00" }),
        ticket({ totalCents: 99999, seats: ["A3"], status: "pending", createdAt: "2026-06-19T10:00:00" }),
      ],
      "count",
      14,
      NOW,
    )
    assert.equal(series[series.length - 2].value, 2)
  })

  it("يعيد أصفارًا عند غياب البيانات", () => {
    const series = salesSeries([], "amount", 14, NOW)
    assert.equal(series.every((point) => point.value === 0 && !point.isPeak), true)
  })
})

describe("شارات حالة العرض", () => {
  it("يميّز النشط والمكتمل والتحضير والأرشيف", () => {
    const future = "2026-07-01T19:00:00+02:00"
    assert.equal(showBadge({ status: "on_sale", occupancy: occupancyInfo(30, 100), startsAt: future, now: NOW }).label, "نشط 🟢")
    assert.equal(
      showBadge({ status: "on_sale", occupancy: occupancyInfo(100, 100), startsAt: future, now: NOW }).label,
      "مكتمل العدد 🔥",
    )
    assert.equal(showBadge({ status: "draft", occupancy: occupancyInfo(0, 100), startsAt: future, now: NOW }).label, "قيد التحضير ⏳")
    assert.equal(
      showBadge({ status: "on_sale", occupancy: occupancyInfo(10, 100), startsAt: "2026-01-01T19:00:00", now: NOW }).label,
      "مؤرشف 📁",
    )
  })

  it("يبني صفوف العروض مرتّبة زمنيًا بالشريط الصحيح", () => {
    const rows = producerShowRows(
      [event({ id: 2, title: "آخر ترام", startsAtIso: "2026-08-01T19:00:00", capacity: 120 }), event({ id: 1 })],
      new Map([[1, 48]]),
      (item) => item.capacity,
      NOW,
    )
    assert.equal(rows[0].id, 1)
    assert.equal(rows[0].occupancy.pct, 50)
    assert.equal(rows[1].id, 2)
  })
})

describe("الكاستينج", () => {
  it("يمنح شارات الحالة الأربع", () => {
    assert.equal(APPLICATION_BADGES.pending.label, "جديد 🆕")
    assert.equal(APPLICATION_BADGES.shortlist.label, "القائمة القصيرة ⭐")
    assert.equal(APPLICATION_BADGES.second_round.label, "مقبول ✅")
    assert.equal(APPLICATION_BADGES.rejected.label, "مرفوض ✖")
  })

  it("يشتق السن حتميًا من البريد", () => {
    assert.equal(derivedAge("karim@kawalees.test"), derivedAge("karim@kawalees.test"))
    assert.ok(derivedAge("karim@kawalees.test") >= 21)
    assert.ok(derivedAge("karim@kawalees.test") <= 34)
  })

  it("يبني رابط واتساب بالصيغة الدولية المصرية", () => {
    const url = whatsappLink("01012345678", "مرحبًا")
    assert.ok(url.startsWith("https://wa.me/201012345678?text="))
    assert.ok(url.includes(encodeURIComponent("مرحبًا")))
  })
})
