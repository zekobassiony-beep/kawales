import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAcceptedStatus,
  shouldPollTickets,
  ticketNeedsServerSync,
} from "../../lib/ticket-poll"

/**
 * قواعد الاستطلاع المقتصد: هي الفرق بين تبويب منسيّ يستهلك حصة الاستضافة،
 * وبين تحديث لحظي في اللحظة التي ينتظر فيها المستخدم فعلًا.
 */
describe("shouldPollTickets (متى نستطلع حالة التذاكر؟)", () => {
  it("لا يستطلع حين لا توجد تذاكر تنتظر شيئًا", () => {
    assert.equal(shouldPollTickets([]), false)
    assert.equal(shouldPollTickets([{ status: "checked_in" }]), false)
    assert.equal(shouldPollTickets([{ status: "rejected" }]), false)
    assert.equal(
      shouldPollTickets([{ status: "approved", ticketImageUrl: "/api/tickets/KW-1/qr.png" }]),
      false,
    )
  })

  it("يستطلع عند وجود تذكرة معلّقة (تنتظر قرار الإدارة)", () => {
    assert.equal(shouldPollTickets([{ status: "pending" }]), true)
    assert.equal(ticketNeedsServerSync({ status: "PENDING" }), true)
  })

  it("يستطلع للتذكرة المقبولة بلا صورة QR بعد", () => {
    assert.equal(shouldPollTickets([{ status: "approved" }]), true)
    assert.equal(shouldPollTickets([{ status: "approved", ticketImageUrl: "" }]), true)
  })

  it("يفهم مرادفات القبول (ACTIVE/confirmed) كما يفهمها التطبيق", () => {
    for (const status of ["ACTIVE", "confirmed", "paid", "Completed"]) {
      assert.equal(isAcceptedStatus(status), true, `${status} يجب أن تُقرأ «مقبولة»`)
      assert.equal(ticketNeedsServerSync({ status }), true)
    }
  })

  it("يعتبر الحضور والرفض حالات منتهية (لا استطلاع)", () => {
    for (const status of ["USED", "declined", "CANCELLED", "cancelled"]) {
      assert.equal(ticketNeedsServerSync({ status }), false, `${status} يجب ألا تستدعي استطلاعًا`)
    }
  })
})
