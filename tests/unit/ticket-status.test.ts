import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTicketAccepted,
  isTicketPending,
  isTicketRejected,
  normalizeTicketStatus,
  ticketStatusLabel,
  ticketStatusTone,
} from "../../lib/ticket-status"
import { mergeTicketRecords, mergeTicketSources, splitTickets, type Ticket } from "../../lib/tickets"

/** تذكرة محلية كاملة (كما يكتبها `createTicket` في المتصفح). */
function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "KW-2DYLP8",
    showId: "show-1",
    showTitle: "ليلة في القهوة",
    venue: "مسرح كواليس، القاهرة",
    startsAt: "2026-12-05T18:00:00Z",
    customerId: "nour@example.com",
    customerName: "نور",
    seats: ["A1"],
    tierName: "VIP",
    totalCents: 35_000,
    paymentMethod: "vodafone_cash",
    paymentRef: "01012345678",
    status: "pending",
    qrCode: "kawalees:ticket:KW-2DYLP8:show-1",
    createdAt: "2026-09-28T10:00:00Z",
    ...overrides,
  }
}

/** تذكرة كما تعود من قاعدة البيانات (بلا حقول عرض + صورة التذكرة من تليجرام). */
function serverTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    ...ticket(),
    showTitle: "",
    venue: "",
    startsAt: "",
    tierName: "",
    customerName: "",
    customerId: "",
    seats: [],
    status: "approved",
    ticketImageUrl: "https://example.test/tickets/KW-2DYLP8.png",
    ...overrides,
  }
}

describe("normalizeTicketStatus (توحيد الحالات)", () => {
  it("يفهم كل مرادفات القبول: approved / ACTIVE / CONFIRMED", () => {
    for (const value of ["approved", "ACTIVE", "Active", " confirmed ", "CONFIRMED", "paid", "COMPLETED"]) {
      assert.equal(normalizeTicketStatus(value), "approved", `${value} should map to approved`)
      assert.equal(isTicketAccepted(value), true)
    }
  })

  it("يفهم مرادفات الحضور والرفض", () => {
    assert.equal(normalizeTicketStatus("checked_in"), "checked_in")
    assert.equal(normalizeTicketStatus("USED"), "checked_in")
    assert.equal(normalizeTicketStatus("declined"), "rejected")
    assert.equal(normalizeTicketStatus("CANCELLED"), "rejected")
    assert.equal(isTicketRejected("cancelled"), true)
  })

  it("يعود إلى «قيد المراجعة» لأي قيمة غير معروفة أو فارغة", () => {
    assert.equal(normalizeTicketStatus(""), "pending")
    assert.equal(normalizeTicketStatus(undefined), "pending")
    assert.equal(normalizeTicketStatus("something_new"), "pending")
    assert.equal(isTicketPending(null), true)
  })

  it("يوفّر التسمية واللون الموحّدين للشارات", () => {
    assert.equal(ticketStatusLabel("ACTIVE"), "مقبول — QR فعّال")
    assert.equal(ticketStatusTone("ACTIVE"), "green")
    assert.equal(ticketStatusTone("USED"), "green")
    assert.equal(ticketStatusTone("declined"), "red")
    assert.equal(ticketStatusTone("pending"), "amber")
  })
})

describe("splitTickets (تبويب القادمة/السابقة)", () => {
  const now = new Date("2026-10-01T12:00:00Z").getTime()

  it("تذكرة قاعدة البيانات بلا موعد تظهر في «القادمة» لا «السابقة»", () => {
    const { upcoming, past } = splitTickets([serverTicket()], now)
    assert.equal(upcoming.length, 1)
    assert.equal(past.length, 0)
  })

  it("الموعد غير الصالح يُعامل كقادم بدل إخفاء التذكرة", () => {
    const { upcoming } = splitTickets([ticket({ startsAt: "" }), ticket({ id: "KW-BAD999", startsAt: "not-a-date" })], now)
    assert.equal(upcoming.length, 2)
  })

  it("يفصل السابق عن القادم حسب الموعد الفعلي", () => {
    const { upcoming, past } = splitTickets(
      [ticket({ id: "KW-FUTURE1" }), ticket({ id: "KW-PAST001", startsAt: "2026-01-01T18:00:00Z" })],
      now,
    )
    assert.deepEqual(upcoming.map((item) => item.id), ["KW-FUTURE1"])
    assert.deepEqual(past.map((item) => item.id), ["KW-PAST001"])
  })
})

describe("mergeTicketRecords (دمج السيرفر مع المخزن المحلي)", () => {
  it("يأخذ الحالة وصورة التذكرة من السيرفر وبيانات العرض من المحلي", () => {
    const merged = mergeTicketRecords(ticket(), serverTicket())
    assert.equal(merged.status, "approved")
    assert.equal(merged.ticketImageUrl, "https://example.test/tickets/KW-2DYLP8.png")
    assert.equal(merged.showTitle, "ليلة في القهوة")
    assert.equal(merged.venue, "مسرح كواليس، القاهرة")
    assert.equal(merged.startsAt, "2026-12-05T18:00:00Z")
    assert.deepEqual(merged.seats, ["A1"])
    assert.equal(merged.tierName, "VIP")
    assert.equal(merged.customerName, "نور")
  })

  it("يُطبّع حالة السيرفر (ACTIVE ⇒ approved) عند الدمج", () => {
    const merged = mergeTicketRecords(ticket(), serverTicket({ status: "ACTIVE" as Ticket["status"] }))
    assert.equal(merged.status, "approved")
    assert.equal(isTicketAccepted(merged.status), true)
  })

  it("لا يمسح الرابط أو الحالة المحلية عند غيابها في السيرفر", () => {
    const merged = mergeTicketRecords(
      ticket({ status: "approved", ticketImageUrl: "https://local.test/t.png" }),
      serverTicket({ status: "approved", ticketImageUrl: undefined }),
    )
    assert.equal(merged.ticketImageUrl, "https://local.test/t.png")
  })
})

describe("mergeTicketSources (قائمة التذاكر الموحّدة)", () => {
  it("يدمج بلا تكرار ويرتّب من الأحدث", () => {
    const merged = mergeTicketSources(
      [serverTicket({ id: "KW-2DYLP8" })],
      [
        ticket({ id: "KW-2DYLP8" }),
        ticket({ id: "KW-GUEST01", createdAt: "2026-09-29T10:00:00Z" }),
      ],
    )
    assert.equal(merged.length, 2)
    assert.deepEqual(merged.map((item) => item.id), ["KW-GUEST01", "KW-2DYLP8"])
  })

  it("يبقي التذاكر المحفوظة محليًا فقط (ضيف بلا صف في قاعدة البيانات)", () => {
    const merged = mergeTicketSources([], [ticket({ id: "KW-LOCAL01" })])
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.id, "KW-LOCAL01")
  })

  it("يبقي تذكرة قاعدة بيانات بلا نظير محلي (تُنشأ من جهاز آخر)", () => {
    const merged = mergeTicketSources([serverTicket({ id: "KW-SERVER1" })], [])
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.status, "approved")
  })
})
