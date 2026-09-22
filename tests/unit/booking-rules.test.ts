import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ON_SALE_STATUS, bookingBlockedReason } from "../../lib/booking-rules"

const NOW = new Date("2026-09-18T12:00:00Z")

describe("bookingBlockedReason", () => {
  it("allows an on-sale performance in the future", () => {
    assert.equal(ON_SALE_STATUS, "on_sale")
    assert.equal(
      bookingBlockedReason({ status: "on_sale", startsAt: new Date("2026-10-05T18:00:00Z") }, NOW),
      null,
    )
  })

  it("accepts ISO strings as well as Date objects", () => {
    assert.equal(
      bookingBlockedReason({ status: "on_sale", startsAt: "2026-10-05T18:00:00Z" }, NOW),
      null,
    )
  })

  it("blocks a performance that already started", () => {
    const reason = bookingBlockedReason(
      { status: "on_sale", startsAt: new Date("2026-08-30T14:28:32Z") },
      NOW,
    )
    assert.match(String(reason), /بدأ هذا العرض/)
  })

  it("blocks a performance starting exactly now", () => {
    assert.match(String(bookingBlockedReason({ status: "on_sale", startsAt: NOW }, NOW)), /بدأ هذا العرض/)
  })

  it("explains sold out and cancelled performances", () => {
    assert.match(
      String(bookingBlockedReason({ status: "sold_out", startsAt: "2026-10-05T18:00:00Z" }, NOW)),
      /نفدت/,
    )
    assert.match(
      String(bookingBlockedReason({ status: "cancelled", startsAt: "2026-10-05T18:00:00Z" }, NOW)),
      /إلغاء/,
    )
  })

  it("falls back to a generic message for other statuses", () => {
    assert.match(
      String(bookingBlockedReason({ status: "draft", startsAt: "2026-10-05T18:00:00Z" }, NOW)),
      /غير متاحة للبيع/,
    )
  })

  it("blocks performances without a valid date", () => {
    assert.match(
      String(bookingBlockedReason({ status: "on_sale", startsAt: "not-a-date" }, NOW)),
      /لم يُحدَّد موعد/,
    )
  })

  it("defaults to the current time", () => {
    // Far enough in the future that the default `now` cannot block it.
    assert.equal(bookingBlockedReason({ status: "on_sale", startsAt: "2999-01-01T00:00:00Z" }), null)
    assert.notEqual(bookingBlockedReason({ status: "on_sale", startsAt: "2000-01-01T00:00:00Z" }), null)
  })
})
