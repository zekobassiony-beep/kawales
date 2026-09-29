import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clampPercent,
  couponDiscountCents,
  couponPriceShape,
  couponScopeMatches,
  couponSnapshotFromShape,
  distributeDiscount,
  remainingCouponUses,
  roundToWholeEgp,
  validateCouponRules,
  type CouponLike,
} from "../../lib/coupon-pricing"
import { calculateTotals } from "../../lib/pricing"

/** كوبون مهرجان مجاني: 100% + رسوم الخدمة مجانًا (الـ Preset الجاهز). */
const FREE_FESTIVAL: CouponLike = {
  code: "FEST-2026-100",
  label: "مهرجان الطليعة",
  discountPct: 100,
  serviceFeeMode: "waived",
}

/** كوبون 51% على التذاكر مع رسوم الخدمة كما هي. */
const HALF_51: CouponLike = { code: "FEST-2026-51", discountPct: 51, serviceFeeMode: "none" }

describe("بلا كوبون — نفس أرقام calculateTotals بلا أي تغيير", () => {
  it("يطابق calculateTotals في المجموع والرسوم والإجمالي", () => {
    for (const prices of [[], [1200], [25000, 15000], [45000, 45000]]) {
      const expected = calculateTotals(prices)
      const shape = couponPriceShape(prices, null)
      assert.equal(shape.originalSubtotalCents, expected.subtotalCents)
      assert.equal(shape.serviceFeeCents, expected.serviceFeeCents)
      assert.equal(shape.totalCents, expected.totalCents)
      assert.equal(shape.hasDiscount, false)
      assert.equal(shape.badgeLabel, "")
      assert.equal(shape.discountedSubtotalCents, expected.subtotalCents)
    }
  })

  it("يعامل undefined مثل null", () => {
    assert.equal(couponPriceShape([25000], undefined).totalCents, calculateTotals([25000]).totalCents)
  })
})

describe("كوبون 100% + إعفاء رسوم الخدمة (مهرجان مجاني)", () => {
  it("تذكرة 100 ج.م تصبح مجانًا والرسوم 10 ج.م تصبح مجانًا", () => {
    const shape = couponPriceShape([10000], FREE_FESTIVAL)
    assert.equal(shape.originalSubtotalCents, 10000)
    assert.equal(shape.discountCents, 10000)
    assert.equal(shape.discountedSubtotalCents, 0)
    assert.equal(shape.discountPctApplied, 100)
    assert.equal(shape.serviceFeeOriginalCents, 1000) // 10% بحد أدنى 5ج
    assert.equal(shape.serviceFeeCents, 0)
    assert.equal(shape.serviceFeeSavingCents, 1000)
    assert.equal(shape.serviceFeeWaived, true)
    assert.equal(shape.totalCents, 0)
    assert.equal(shape.isFree, true)
    assert.equal(shape.badgeLabel, "FREE")
    assert.equal(shape.serviceFeeBadge, "مجانًا")
    assert.equal(shape.hasDiscount, true)
  })

  it("يعمل مع 150 ج.م و74 ج.م أيضًا", () => {
    assert.equal(couponPriceShape([15000], FREE_FESTIVAL).serviceFeeOriginalCents, 1500)
    assert.equal(couponPriceShape([15000], FREE_FESTIVAL).totalCents, 0)
    assert.equal(couponPriceShape([7400], FREE_FESTIVAL).totalCents, 0)
  })
})

describe("كوبون 51% على التذاكر (150 ج.م → 74 ج.م)", () => {
  it("ينزل السعر إلى 74 ج.م ويعرض الخصم 51%", () => {
    const shape = couponPriceShape([15000], HALF_51)
    assert.equal(shape.discountedSubtotalCents, 7400)
    assert.equal(shape.discountCents, 7600)
    assert.equal(shape.discountPctApplied, 51)
    assert.equal(shape.badgeLabel, "-51%")
    assert.equal(shape.serviceFeeWaived, false)
    assert.equal(shape.serviceFeeBadge, "")
  })

  it("رسوم الخدمة تُحسب على المبلغ بعد الخصم ثم تُقرَّب لجنيه صحيح", () => {
    const shape = couponPriceShape([15000], HALF_51)
    // 10% من 74 ج.م = 7.4 ج.م ⇒ تُقرَّب إلى 7 ج.م
    assert.equal(shape.serviceFeeCents, 700)
    assert.equal(shape.totalCents, 8100)
  })

  it("مع إعفاء الرسوم يصبح الإجمالي 74 ج.م ورسوم الخدمة مجانًا", () => {
    const shape = couponPriceShape([15000], { ...HALF_51, serviceFeeMode: "waived" })
    assert.equal(shape.serviceFeeCents, 0)
    // «لولا الكوبون» = رسوم الـ74 ج.م (7 ج.م) لأن خصم التذاكر خفّض الرسوم أصلًا
    assert.equal(shape.serviceFeeOriginalCents, 700)
    assert.equal(shape.serviceFeeSavingCents, 700)
    assert.equal(shape.totalCents, 7400)
    assert.equal(shape.badgeLabel, "-51%")
    assert.equal(shape.serviceFeeBadge, "مجانًا")
  })
})

describe("خفض رسوم الخدمة بنفس نسبة الكوبون", () => {
  it("كوبون 50% على 200 ج.م: الرسوم 10 ج.م تصبح 5 ج.م", () => {
    const shape = couponPriceShape([20000], { code: "HALF", discountPct: 50, serviceFeeMode: "same" })
    assert.equal(shape.discountedSubtotalCents, 10000)
    // 10% من 100 ج.م = 10 ج.م ثم نصفها = 5 ج.م (وهي أيضًا الحد الأدنى)
    assert.equal(shape.serviceFeeCents, 500)
    assert.equal(shape.serviceFeeOriginalCents, 1000)
    assert.equal(shape.serviceFeeSavingCents, 500)
    assert.equal(shape.serviceFeeBadge, "-50%")
    assert.equal(shape.totalCents, 10500)
  })

  it("لا يعرض بادج خصم وهميًا على رسوم الخدمة في وضع «بلا خصم»", () => {
    const shape = couponPriceShape([15000], HALF_51)
    assert.equal(shape.serviceFeeSavingCents, 0)
    assert.equal(shape.serviceFeeBadge, "")
    assert.equal(shape.serviceFeeOriginalCents, shape.serviceFeeCents)
  })
})

describe("سقف الخصم ونسب غير صالحة", () => {
  it("يحترم maxDiscountCents", () => {
    const shape = couponPriceShape([15000], {
      code: "CAPPED",
      discountPct: 100,
      serviceFeeMode: "none",
      maxDiscountCents: 3000,
    })
    assert.equal(shape.discountCents, 3000)
    assert.equal(shape.discountedSubtotalCents, 12000)
    assert.equal(shape.discountPctApplied, 20)
  })

  it("يحصر النسب في 0..100 ويهمل غير الرقمي", () => {
    assert.equal(clampPercent(-5), 0)
    assert.equal(clampPercent(150), 100)
    assert.equal(clampPercent("50"), 50)
    assert.equal(clampPercent(Number.NaN), 0)
    assert.equal(couponDiscountCents(10000, { code: "X", discountPct: 150, serviceFeeMode: "none" }), 10000)
    assert.equal(couponDiscountCents(10000, { code: "X", discountPct: -20, serviceFeeMode: "none" }), 0)
    assert.equal(couponDiscountCents(10000, null), 0)
  })

  it("يبقي المعادلة: الأصلي = الخصم + المخفَّض مع أسعار كسرية", () => {
    const shape = couponPriceShape([12550], { code: "ODD", discountPct: 15, serviceFeeMode: "none" })
    assert.equal(shape.discountCents + shape.discountedSubtotalCents, shape.originalSubtotalCents)
    assert.equal(shape.discountedSubtotalCents, 10700)
    assert.equal(shape.discountPctApplied, 15)
  })

  it("يتجاهل أسعارًا غير صالحة في القائمة", () => {
    const shape = couponPriceShape([Number.NaN, 5000, Number.POSITIVE_INFINITY], null)
    assert.equal(shape.originalSubtotalCents, 5000)
  })

  it("يجمع عدة مقاعد ثم يطبّق الكوبون", () => {
    const shape = couponPriceShape([25000, 15000], { code: "HALF", discountPct: 50, serviceFeeMode: "none" })
    assert.equal(shape.originalSubtotalCents, 40000)
    assert.equal(shape.discountedSubtotalCents, 20000)
    assert.equal(shape.serviceFeeCents, 2000)
    assert.equal(shape.totalCents, 22000)
  })
})

describe("roundToWholeEgp", () => {
  it("يقرّب لأقرب جنيه صحيح", () => {
    assert.equal(roundToWholeEgp(7350), 7400)
    assert.equal(roundToWholeEgp(740), 700)
    assert.equal(roundToWholeEgp(750), 800)
    assert.equal(roundToWholeEgp(7400), 7400)
    assert.equal(roundToWholeEgp(0), 0)
    assert.equal(roundToWholeEgp(Number.NaN), 0)
  })
})

describe("distributeDiscount (توزيع الخصم على المقاعد)", () => {
  it("يجعل مجموع أسعار المقاعد = المبلغ المخفَّض بالضبط", () => {
    const units = distributeDiscount([10000, 10000, 10000], 7400)
    assert.equal(units.reduce((sum, value) => sum + value, 0), 7400)
    assert.equal(units.length, 3)
  })

  it("يوزّع تناسبيًا مع اختلاف أسعار المقاعد", () => {
    const units = distributeDiscount([20000, 10000], 15000)
    assert.deepEqual(units, [10000, 5000])
  })

  it("كوبون 100% ⇒ كل المقاعد مجانًا", () => {
    assert.deepEqual(distributeDiscount([20000, 10000], 0), [0, 0])
  })

  it("يتعامل مع القوائم الفارغة والأسعار غير الصالحة", () => {
    assert.deepEqual(distributeDiscount([], 0), [])
    assert.deepEqual(distributeDiscount([0, 0], 0), [0, 0])
    assert.equal(distributeDiscount([Number.NaN, 5000], 4000).reduce((sum, v) => sum + v, 0), 4000)
  })

  it("لا يتجاوز الإجمالي الأصلي ولا ينزل تحت الصفر", () => {
    const over = distributeDiscount([10000], 99999)
    assert.equal(over[0], 10000)
    const under = distributeDiscount([10000], -500)
    assert.equal(under[0], 0)
  })
})

describe("couponSnapshotFromShape", () => {
  it("يبني لقطة قابلة للتخزين مع التذكرة", () => {
    const shape = couponPriceShape([15000], HALF_51)
    const snapshot = couponSnapshotFromShape(shape)
    assert.equal(snapshot.code, "FEST-2026-51")
    assert.equal(snapshot.discountPct, 51)
    assert.equal(snapshot.discountCents, 7600)
    assert.equal(snapshot.originalTotalCents, 15000 + shape.serviceFeeOriginalCents)
  })

  it("يحفظ إعفاء رسوم الخدمة للمهرجان المجاني", () => {
    const snapshot = couponSnapshotFromShape(couponPriceShape([10000], FREE_FESTIVAL), "مهرجان الطليعة")
    assert.equal(snapshot.label, "مهرجان الطليعة")
    assert.equal(snapshot.serviceFeeSavingCents, 1000)
    assert.equal(snapshot.originalTotalCents, 11000)
    assert.equal(snapshot.serviceFeeMode, "waived")
  })
})

