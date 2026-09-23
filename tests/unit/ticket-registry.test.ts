import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyTicketDecision,
  getTicketRecord,
  getTicketStatus,
  registerTicketRecord,
  rejectTicketOnServer,
  verifyTicketOnServer,
} from "../../lib/ticket-registry"

function seed(ticketId: string): void {
  registerTicketRecord({
    ticketId,
    qrPayload: `kawalees:ticket:${ticketId}:show-1`,
    showTitle: "ليلة في القهوة",
    seatsLabel: "A4، A5",
    customerName: "سلمى",
    senderPhone: "01012345678",
    totalCents: 30000,
    status: "pending",
  })
}

describe("applyTicketDecision (قرار الإدارة)", () => {
  it("يعتمد التذكرة عند القبول ويحدّث الحالة", () => {
    seed("KW-TEST01")
    const result = applyTicketDecision("KW-TEST01", "approved")
    assert.equal(result.status, "approved")
    assert.equal(result.alreadyDecided, false)
    assert.equal(result.message, "تم قبول الحجز وتأكيد التذكرة ✅")
    assert.equal(getTicketStatus("KW-TEST01"), "approved")
  })

  it("يرفض التذكرة عند الرفض", () => {
    seed("KW-TEST02")
    const result = rejectTicketOnServer("KW-TEST02")
    assert.equal(result.status, "rejected")
    assert.equal(result.message, "تم رفض الحجز ❌")
    assert.equal(getTicketStatus("KW-TEST02"), "rejected")
  })

  it("آمن مع تكرار الضغط (idempotent) ويوضّح أن القرار سابق", () => {
    seed("KW-TEST03")
    verifyTicketOnServer("KW-TEST03")
    const second = verifyTicketOnServer("KW-TEST03")
    assert.equal(second.alreadyDecided, true)
    assert.equal(second.status, "approved")
    assert.equal(second.message, "هذه التذكرة معتمدة بالفعل ✅")

    rejectTicketOnServer("KW-TEST03")
    const flipped = rejectTicketOnServer("KW-TEST03")
    assert.equal(flipped.alreadyDecided, true)
    assert.equal(flipped.status, "rejected")
  })

  it("يطبّع كود التذكرة (حالة الأحرف والمسافات)", () => {
    seed("KW-TEST04")
    const result = applyTicketDecision("  kw-test04 ", "approved")
    assert.equal(result.record.ticketId, "KW-TEST04")
    assert.equal(getTicketStatus("kw-test04"), "approved")
  })

  it("يُنشئ سجلًا مصغّرًا لتذكرة غير مسجّلة مع حمولة QR افتراضية", () => {
    const result = verifyTicketOnServer("KW-UNKNOWN9")
    assert.equal(result.record.ticketId, "KW-UNKNOWN9")
    assert.equal(result.record.qrPayload, "kawalees:ticket:KW-UNKNOWN9")
    assert.equal(result.record.status, "approved")
    assert.equal(getTicketRecord("KW-UNKNOWN9")?.status, "approved")
  })
})
