import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isTicketQrPayload, parseTicketCode, ticketQrImagePath, TICKET_QR_PREFIX } from "../../lib/ticket-code"

describe("parseTicketCode (كود التذكرة المقروء في البوابة)", () => {
  it("يستخرج المعرّف من حمولة QR الكاملة", () => {
    assert.equal(parseTicketCode("kawalees:ticket:KW-2DYLP8:show-1"), "KW-2DYLP8")
    assert.equal(parseTicketCode("KAWALEES:TICKET:KW-ABC123:show-9"), "KW-ABC123")
  })

  it("يقبل المعرّف المجرّد (الإدخال اليدوي أو ماسح يقرأ المعرّف وحده)", () => {
    assert.equal(parseTicketCode("KW-2DYLP8"), "KW-2DYLP8")
    assert.equal(parseTicketCode("  kw-2dylp8\n"), "KW-2DYLP8")
  })

  it("ينظّف علامات التنصيص والأقواس التي تلتقطها الكاميرا حول الرمز", () => {
    assert.equal(parseTicketCode("«KW-2DYLP8»"), "KW-2DYLP8")
    assert.equal(parseTicketCode('"KW-2DYLP8"'), "KW-2DYLP8")
  })

  it("يرفض أي نص غير صالح (لا نُنشئ تذكرة وهمية من قراءة خاطئة)", () => {
    const invalid = [
      "",
      "   ",
      "AB",
      "KW",
      "kawalees:ticket:",
      "kawalees:ticket:ab:show-1",
      "https://kawalees.test/t/KW-1",
    ]
    for (const value of invalid) {
      assert.equal(parseTicketCode(value), "", `${JSON.stringify(value)} يجب أن تُرفض`)
    }
    assert.equal(parseTicketCode(null), "")
    assert.equal(parseTicketCode(undefined), "")
  })

  it("يميّز حمولة المنصة عن أي نص آخر", () => {
    assert.equal(isTicketQrPayload(`${TICKET_QR_PREFIX}KW-1`), true)
    assert.equal(isTicketQrPayload("kawalees:ticket:KW-1:show-1"), true)
    assert.equal(isTicketQrPayload("KW-1"), false)
    assert.equal(isTicketQrPayload(""), false)
  })
})

describe("ticketQrImagePath (صورة التذكرة على السيرفر)", () => {
  it("يبني مسار المُصدِّر الذي يولّد الصورة عند الطلب", () => {
    assert.equal(ticketQrImagePath("KW-2DYLP8"), "/api/tickets/KW-2DYLP8/qr.png")
  })

  it("يُطبّع المعرّف (حالة الأحرف والمسافات)", () => {
    assert.equal(ticketQrImagePath("  kw-2dylp8  "), "/api/tickets/KW-2DYLP8/qr.png")
  })

  it("يمنع كسر المسار بمحارف غير متوقعة", () => {
    assert.equal(ticketQrImagePath("KW-1/../evil"), "/api/tickets/KW-1%2F..%2FEVIL/qr.png")
  })
})
