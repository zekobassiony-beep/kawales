import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeServerTicketUpdate, type Ticket } from "../../lib/tickets"

/** تذكرة محلية جاهزة للاختبار (نفس شكل `createTicket`). */
function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "KW-ABC123",
    showId: "show-1",
    showTitle: "ليلة في القهوة",
    venue: "مسرح كواليس، القاهرة",
    startsAt: "2026-10-05T18:00:00Z",
    customerId: "nour@example.com",
    customerName: "نور",
    seats: ["A1", "A2"],
    tierName: "VIP",
    totalCents: 35_000,
    paymentMethod: "vodafone_cash",
    paymentRef: "01012345678",
    status: "pending",
    qrCode: "kawalees:ticket:KW-ABC123:show-1",
    createdAt: "2026-09-28T10:00:00Z",
    ...overrides,
  }
}

describe("mergeServerTicketUpdate (مزامنة قرار تليجرام)", () => {
  it("يحوّل التذكرة إلى approved مع مصدر الاعتماد", () => {
    const merged = mergeServerTicketUpdate(ticket(), { id: "KW-ABC123", status: "approved" })
    assert.ok(merged)
    assert.equal(merged.status, "approved")
    assert.equal(merged.verifiedVia, "telegram")
    assert.ok(merged.verifiedAt)
  })

  it("يحوّل التذكرة إلى rejected بلا وسيلة اعتماد", () => {
    const merged = mergeServerTicketUpdate(ticket({ status: "approved" }), {
      id: "KW-ABC123",
      status: "rejected",
    })
    assert.ok(merged)
    assert.equal(merged.status, "rejected")
    assert.equal(merged.verifiedVia, undefined)
  })

  it("يضيف رابط صورة التذكرة حتى لو لم تتغير الحالة", () => {
    const url = "https://example.test/tickets/KW-ABC123.png"
    const merged = mergeServerTicketUpdate(ticket({ status: "approved" }), {
      id: "KW-ABC123",
      status: "approved",
      ticketImageUrl: url,
    })
    assert.ok(merged)
    assert.equal(merged.ticketImageUrl, url)
  })

  it("لا يُنشئ تغييرًا بايتًا عندما لا يوجد جديد (توفير لكتابة التخزين)", () => {
    const url = "https://example.test/tickets/KW-ABC123.png"
    assert.equal(
      mergeServerTicketUpdate(ticket({ status: "approved", ticketImageUrl: url }), {
        id: "KW-ABC123",
        status: "approved",
        ticketImageUrl: url,
      }),
      null,
    )
    assert.equal(mergeServerTicketUpdate(ticket(), { id: "KW-ABC123", status: "pending" }), null)
  })

  it("لا يلمس تذكرة أخرى (حماية من مزامنة خاطئة)", () => {
    assert.equal(mergeServerTicketUpdate(ticket(), { id: "KW-OTHER9", status: "approved" }), null)
  })

  it("يحافظ على صورة التذكرة عند الانتقال إلى checked_in", () => {
    const url = "https://example.test/tickets/KW-ABC123.png"
    const merged = mergeServerTicketUpdate(ticket({ status: "approved", ticketImageUrl: url }), {
      id: "KW-ABC123",
      status: "checked_in",
    })
    assert.ok(merged)
    assert.equal(merged.status, "checked_in")
    assert.equal(merged.ticketImageUrl, url)
  })
})
