import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  couponScopeMatches,
  remainingCouponUses,
  validateCouponRules,
  type CouponRuleLike,
} from "../../lib/coupon-pricing"

const NOW = new Date("2026-10-15T12:00:00.000Z")

function coupon(patch: Partial<CouponRuleLike> = {}): CouponRuleLike {
  return {
    code: "FEST-2026-100",
    label: "مهرجان مجاني",
    discountPct: 100,
    serviceFeeMode: "waived",
    status: "active",
    usedCount: 0,
    ...patch,
  }
}

describe("قواعد قبول الكوبون", () => {
  it("يرفض الكود الفارغ أو غير الموجود", () => {
    assert.equal(validateCouponRules(null, {}, NOW).reason, "empty")
    assert.equal(validateCouponRules({ ...coupon(), code: "  " }, {}, NOW).reason, "empty")
  })

  it("يقبل الكوبون النشط بلا حدود", () => {
    const result = validateCouponRules(coupon(), {}, NOW)
    assert.equal(result.ok, true)
    assert.match(result.message, /FEST-2026-100/)
  })

  it("يرفض الموقوف من الإدارة", () => {
    const result = validateCouponRules(coupon({ status: "disabled" }), {}, NOW)
    assert.equal(result.ok, false)
    assert.equal(result.reason, "disabled")
  })

  it("يرفض ما لم يبدأ بعد وما انتهى", () => {
    assert.equal(
      validateCouponRules(coupon({ startsAt: "2026-11-01T00:00:00.000Z" }), {}, NOW).reason,
      "not_started",
    )
    assert.equal(
      validateCouponRules(coupon({ endsAt: "2026-10-01T00:00:00.000Z" }), {}, NOW).reason,
      "expired",
    )
    // تاريخ غير صالح يُهمَل ولا يعطّل الكوبون
    assert.equal(validateCouponRules(coupon({ endsAt: "not-a-date" }), {}, NOW).ok, true)
  })

  it("يقبل ما زال داخل مدته", () => {
    assert.equal(
      validateCouponRules(coupon({ startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-31T23:59:00.000Z" }), {}, NOW).ok,
      true,
    )
  })

  it("يرفض المستهلك بالكامل (سقف الاستخدام أو وسم exhausted)", () => {
    assert.equal(validateCouponRules(coupon({ maxUses: 3, usedCount: 3 }), {}, NOW).reason, "exhausted")
    assert.equal(validateCouponRules(coupon({ status: "exhausted" }), {}, NOW).reason, "exhausted")
  })

  it("يرفض تجاوز حد العميل الواحد", () => {
    const limited = coupon({ maxUsesPerCustomer: 1 })
    assert.equal(validateCouponRules(limited, { customerUses: 1 }, NOW).reason, "customer_limit")
    assert.equal(validateCouponRules(limited, { customerUses: 0 }, NOW).ok, true)
    assert.equal(
      validateCouponRules(coupon({ maxUsesPerCustomer: 2 }), { customerUses: 2 }, NOW).reason,
      "customer_limit",
    )
  })

  it("يحدّ الكوبون بعرض أو فرقة أو مسرح بعينه", () => {
    const eventScoped = coupon({ scope: { kind: "event", ids: [7] } })
    assert.equal(validateCouponRules(eventScoped, { eventId: 7 }, NOW).ok, true)
    assert.equal(validateCouponRules(eventScoped, { eventId: 8 }, NOW).reason, "out_of_scope")

    const troupeScoped = coupon({ scope: { kind: "troupe", ids: [2] } })
    assert.equal(validateCouponRules(troupeScoped, { troupeId: 2 }, NOW).ok, true)
    assert.equal(validateCouponRules(troupeScoped, { troupeId: 5 }, NOW).reason, "out_of_scope")
    // بدون معرّف في السياق لا يمكن إثبات الشمول ⇒ رفض
    assert.equal(validateCouponRules(troupeScoped, {}, NOW).reason, "out_of_scope")

    const venueScoped = coupon({ scope: { kind: "venue", ids: [3] } })
    assert.equal(validateCouponRules(venueScoped, { venueId: 3 }, NOW).ok, true)
    assert.equal(validateCouponRules(venueScoped, { venueId: 4 }, NOW).reason, "out_of_scope")
  })
})

describe("نطاق الكوبون وعدد الاستخدامات", () => {
  it("النطاق العام أو الفارغ يقبل أي سياق", () => {
    assert.equal(couponScopeMatches({ kind: "all", ids: [1] }, {}), true)
    assert.equal(couponScopeMatches({ kind: "event", ids: [] }, {}), true)
    assert.equal(couponScopeMatches(undefined, {}), true)
  })

  it("يعرض الاستخدامات المتبقية وبلا حد = Infinity", () => {
    assert.equal(remainingCouponUses({ maxUses: 0, usedCount: 9 }), Number.POSITIVE_INFINITY)
    assert.equal(remainingCouponUses({ maxUses: 3, usedCount: 1 }), 2)
    assert.equal(remainingCouponUses({ maxUses: 3, usedCount: 7 }), 0)
    assert.equal(remainingCouponUses({}), Number.POSITIVE_INFINITY)
  })
})
