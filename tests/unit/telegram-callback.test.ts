import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  adminMissingCustomerChatNotice,
  callbackAckText,
  customerApprovedNotice,
  customerRejectedNotice,
  decisionBanner,
  handleTicketDecision,
  parseCallbackData,
  qrCaption,
  shouldPublishTicket,
} from "../../lib/telegram-callback"
import type { TicketDecisionResult } from "../../lib/ticket-registry"

/** نتيجة قرار جاهزة للاختبار (بنفس شكل `applyTicketDecision` الحقيقي). */
function decision(overrides: Partial<TicketDecisionResult> = {}): TicketDecisionResult {
  return {
    ok: true,
    alreadyDecided: false,
    status: "approved",
    message: "تم قبول الحجز وتأكيد التذكرة ✅",
    record: {
      ticketId: "KW-ABC123",
      qrPayload: "kawalees:ticket:KW-ABC123:show-1",
      showTitle: "ليلة في القهوة",
      seatsLabel: "A1، A2",
      customerName: "نور",
      senderPhone: "01012345678",
      totalCents: 35_000,
      status: "approved",
      updatedAt: "2026-09-28T10:00:00Z",
    },
    ...overrides,
  }
}

describe("parseCallbackData", () => {
  it("يفكّ زر القبول وزر الرفض", () => {
    assert.deepEqual(parseCallbackData("approve_KW-ABC123"), {
      action: "approve",
      ticketId: "KW-ABC123",
      raw: "approve_KW-ABC123",
    })
    const reject = parseCallbackData("reject_KW-XYZ999")
    assert.equal(reject?.action, "reject")
    assert.equal(reject?.ticketId, "KW-XYZ999")
  })

  it("يُوحّد حالة الأحرف والمسافات", () => {
    assert.equal(parseCallbackData(" approve_kw-abc123 ")?.ticketId, "KW-ABC123")
  })

  it("يرفض أي بيانات غير صالحة (لا قرار على تذكرة مجهولة)", () => {
    assert.equal(parseCallbackData(undefined), null)
    assert.equal(parseCallbackData(""), null)
    assert.equal(parseCallbackData("approve_"), null)
    assert.equal(parseCallbackData("delete_KW-ABC123"), null)
    assert.equal(parseCallbackData("approve_KW"), null)
    assert.equal(parseCallbackData("approve_123456"), null)
  })
})

describe("callbackAckText", () => {
  it("يعطي نصًا واضحًا لكل إجراء (يوقف دوران الزر)", () => {
    assert.equal(callbackAckText({ action: "approve", ticketId: "KW-ABC123", raw: "" }), "تم القبول ✅")
    assert.equal(callbackAckText({ action: "reject", ticketId: "KW-ABC123", raw: "" }), "تم الرفض ❌")
    assert.match(callbackAckText(null), /لا يوجد إجراء/)
  })
})

describe("shouldPublishTicket", () => {
  it("ينشر صورة التذكرة فقط عند قبول جديد", () => {
    const approve = { action: "approve", ticketId: "KW-ABC123", raw: "" } as const
    const reject = { action: "reject", ticketId: "KW-ABC123", raw: "" } as const
    assert.equal(shouldPublishTicket(approve, decision()), true)
    assert.equal(shouldPublishTicket(approve, decision({ alreadyDecided: true })), false)
    assert.equal(shouldPublishTicket(reject, decision({ status: "rejected" })), false)
    assert.equal(shouldPublishTicket(approve, null), false)
  })
})

describe("رسائل القرار", () => {
  it("qrCaption تحمل كود التذكرة والعرض", () => {
    const caption = qrCaption(decision())
    assert.match(caption, /KW-ABC123/)
    assert.match(caption, /ليلة في القهوة/)
  })

  it("decisionBanner تعرض نتيجة القرار والكود", () => {
    assert.match(decisionBanner(decision()), /✅/)
    assert.match(decisionBanner(decision({ status: "rejected", message: "تم رفض الحجز ❌" })), /❌/)
  })

  it("رسائل العميل توضّح القبول والرفض", () => {
    assert.match(customerApprovedNotice("KW-ABC123"), /KW-ABC123/)
    assert.match(customerRejectedNotice("KW-ABC123"), /KW-ABC123/)
    assert.match(adminMissingCustomerChatNotice("KW-ABC123", "rejected"), /KW-ABC123/)
  })
})

describe("handleTicketDecision", () => {
  it("ينادي الإجراء الصحيح ويعيد النتيجة", async () => {
    const called: string[] = []
    const result = await handleTicketDecision(
      { action: "reject", ticketId: "KW-ABC123", raw: "" },
      {
        approve: async (id) => {
          called.push(`approve:${id}`)
          return decision()
        },
        reject: async (id) => {
          called.push(`reject:${id}`)
          return decision({ status: "rejected" })
        },
      },
    )
    assert.deepEqual(called, ["reject:KW-ABC123"])
    assert.equal(result?.status, "rejected")
  })

  it("لا يرمي أي خطأ عند فشل القاعدة (يعيد null)", async () => {
    const logs: string[] = []
    const result = await handleTicketDecision(
      { action: "approve", ticketId: "KW-ABC123", raw: "" },
      {
        approve: async () => {
          throw new Error("database down")
        },
        reject: async () => null,
        log: (line) => logs.push(line),
      },
    )
    assert.equal(result, null)
    assert.ok(logs.some((line) => line.includes("database down")))
  })
})
