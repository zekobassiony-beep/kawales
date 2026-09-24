import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATTENDANCE_POLICY,
  giftLink,
  giftMessage,
  passMapsUrl,
  passStats,
  passStatus,
  splitByTab,
  tierMetal,
} from "../../lib/ticket-pass"
import { qrMatrix, withQuietZone, QR_QUIET_ZONE } from "../../lib/qr"
import type { Ticket } from "../../lib/tickets"

const NOW = new Date("2026-06-20T12:00:00")

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "KW-ABC123",
    showId: "1",
    showTitle: "ليلة في القهوة",
    venue: "مسرح الهوسابير، القاهرة",
    startsAt: "الأحد ١٢ يوليو ٢٠٢٦",
    startsAtIso: "2026-07-12T19:00:00+02:00",
    customerId: "customer@kawalees.test",
    customerName: "سلمى",
    seats: ["A4"],
    tierName: "أوركسترا",
    totalCents: 25000,
    paymentMethod: "vodafone_cash",
    paymentRef: "01000000000",
    status: "approved",
    qrCode: "kawalees:ticket:KW-ABC123:1",
    createdAt: "2026-06-18T10:00:00",
    ...overrides,
  }
}

describe("شارات حالة التذكرة (Pass)", () => {
  it("يميّز الحالات الأربع ويحدّد إتاحة QR", () => {
    assert.equal(passStatus("approved").label, "معتمدة وجاهزة ✅")
    assert.equal(passStatus("approved").admitted, true)
    assert.equal(passStatus("checked_in").label, "تم استخدامها/حضر 🎭")
    assert.equal(passStatus("pending").tone, "amber")
    assert.equal(passStatus("pending").admitted, false)
    assert.equal(passStatus("rejected").label, "إيصال مرفوض ✖")
    assert.equal(passStatus("rejected").tone, "red")
  })
})

describe("تصفية التبويبات والإحصائيات", () => {
  it("يوزّع التذاكر على القادم والسابق والمعلّق", () => {
    const buckets = splitByTab(
      [
        ticket({ id: "KW-1", startsAtIso: "2026-07-12T19:00:00+02:00", status: "approved" }),
        ticket({ id: "KW-2", startsAtIso: "2026-01-05T19:00:00+02:00", status: "approved" }),
        ticket({ id: "KW-3", startsAtIso: "2026-08-01T19:00:00+02:00", status: "pending" }),
        ticket({ id: "KW-4", startsAtIso: "2026-09-01T19:00:00+02:00", status: "rejected" }),
        ticket({ id: "KW-5", startsAtIso: "2026-06-01T19:00:00+02:00", status: "checked_in" }),
      ],
      NOW,
    )
    assert.deepEqual(
      buckets.upcoming.map((item) => item.id),
      ["KW-1"],
    )
    assert.deepEqual(
      buckets.past.map((item) => item.id),
      ["KW-5", "KW-2"],
    )
    assert.deepEqual(
      buckets.pending.map((item) => item.id),
      ["KW-3", "KW-4"],
    )
  })

  it("يحسب الإحصائيات الثلاثة", () => {
    const stats = passStats(
      [
        ticket({ id: "KW-1", status: "approved", startsAtIso: "2026-07-12T19:00:00+02:00" }),
        ticket({ id: "KW-2", status: "checked_in", startsAtIso: "2026-06-01T19:00:00+02:00" }),
        ticket({ id: "KW-3", status: "pending", startsAtIso: "2026-08-01T19:00:00+02:00" }),
      ],
      NOW,
    )
    assert.equal(stats.activeUpcoming, 1)
    assert.equal(stats.attended, 1)
    assert.equal(stats.pending, 1)
  })

  it("يعامل التذكرة بلا موعد صالح كقادمة", () => {
    const buckets = splitByTab([ticket({ startsAtIso: undefined, startsAt: "" , status: "approved" })], NOW)
    assert.equal(buckets.upcoming.length, 1)
  })
})

describe("الفئة المعدنية والإهداء واللوكيشن", () => {
  it("يمنح الفئة المعدنية حسب سعر المقعد أو الاسم", () => {
    const unitPrices = [50000, 25000, 15000]
    assert.equal(tierMetal("أوركسترا", 50000, unitPrices), "دايموند")
    assert.equal(tierMetal("بلكونة", 15000, unitPrices), "فضي")
    assert.equal(tierMetal("VIP خاص", 1000, unitPrices), "دايموند")
    // أربع فئات ⇒ البرونزي هو الأرخص.
    assert.equal(tierMetal("اقتصادي", 10000, [50000, 30000, 20000, 10000]), "برونزي")
  })

  it("يبني رابط الإهداء ورسالته", () => {
    assert.equal(giftLink("KW-ABC123", "https://kawalees.com"), "https://kawalees.com/dashboard/tickets?gift=KW-ABC123")
    const message = giftMessage(ticket())
    assert.ok(message.includes("KW-ABC123"))
    assert.ok(message.includes("ليلة في القهوة"))
  })

  it("يستخدم رابط المسرح أو بحث جوجل تلقائيًا", () => {
    assert.equal(passMapsUrl("مسرح", "https://maps.app.goo.gl/x"), "https://maps.app.goo.gl/x")
    assert.ok(passMapsUrl("مسرح الهوسابير، القاهرة").startsWith("https://www.google.com/maps/search/?api=1&query="))
  })

  it("يتضمن سياسة الحضور", () => {
    assert.ok(ATTENDANCE_POLICY.length >= 4)
    assert.ok(ATTENDANCE_POLICY.some((rule) => rule.includes("30 دقيقة")))
  })
})

describe("رمز QR للتذكرة", () => {
  it("يُنتج مصفوفة صالحة وثابتة لحمولة التذكرة", () => {
    const payload = "kawalees:ticket:KW-ABC123:1"
    const matrix = qrMatrix(payload)
    assert.deepEqual(matrix, qrMatrix(payload))
    assert.equal(matrix.length % 4, 1)
    // أنماط الموقع في الأركان الثلاثة (حلقة داكنة).
    assert.equal(matrix[0][0], true)
    assert.equal(matrix[0][matrix.length - 1], true)
    assert.equal(matrix[matrix.length - 1][0], true)
  })

  it("يحيط الرمز بمنطقة هدوء بيضاء لتحسين الكسح", () => {
    const padded = withQuietZone(qrMatrix("kawalees:ticket:KW-ABC123:1"))
    assert.equal(padded.length, qrMatrix("kawalees:ticket:KW-ABC123:1").length + QR_QUIET_ZONE * 2)
    assert.equal(padded[0].every((cell) => cell === false), true)
  })
})
