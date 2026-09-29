/**
 * حساب أسعار الكوبونات (وحدة **نقية** قابلة للاختبار — تُستعمل في المتصفح والسيرفر معًا).
 *
 * نموذج الخصم:
 *  1) `subtotal`   = مجموع أسعار التذاكر.
 *  2) `discount`   = نسبة الكوبون من `subtotal` (مقصوصة بسقف `maxDiscountCents`).
 *  3) `discounted` = `subtotal − discount` — ويُقرَّب لأقرب **جنيه صحيح** حتى يطابق
 *                    المعروض (`format.ts:formatPrice`) المبلغ المدفوع فعلًا.
 *  4) `serviceFee` = `calculateServiceFee(discounted)` (10% بحد أدنى 5ج — `lib/pricing`).
 *  5) وضع رسوم الخدمة:
 *       - `none`   : الرسوم كما هي.
 *       - `same`   : تُخصم بنفس نسبة خصم التذاكر.
 *       - `waived` : صفر ⇒ «رسوم الخدمة: مجانًا».
 *  6) `total` = `discounted + serviceFee`.
 *
 * وللعرض نُصدّر «شكل الخصم»: السعر الأصلي مشطوب، والسعر الجديد بجانبه، وسطر رسوم
 * الخدمة يعرض ما كان سيُدفع لولا الكوبون (`serviceFeeOriginalCents`) مشطوبًا ثم الجديد.
 *
 * ملاحظة مهمة: بدون كوبون (`coupon = null`) تُعاد **نفس** أرقام `lib/pricing:calculateTotals`
 * حرفيًا (بلا أي تقريب) حتى لا يحدث أي انحدار في مسار الحجز الحالي.
 */

import { calculateServiceFee } from "@/lib/pricing"

/** خصم رسوم الخدمة: بلا / نفس نسبة الكوبون / إعفاء كامل (Free). */
export type ServiceFeeMode = "none" | "same" | "waived"

export type CouponStatus = "active" | "disabled" | "expired" | "exhausted"

export type CouponScopeKind = "all" | "event" | "troupe" | "venue"

export type CouponScope = {
  kind: CouponScopeKind
  /** معرّفات العروض/الفرق/المسارح — تُهمَل عند `kind = "all"`. */
  ids: number[]
}

/** الحقول التي يحتاجها الحساب من الكوبون (بقية حقول المخزن لا تهم هنا). */
export type CouponLike = {
  code: string
  label?: string
  /** نسبة الخصم على سعر التذاكر 0..100 (100 = مجاني). */
  discountPct: number
  serviceFeeMode: ServiceFeeMode
  /** سقف مبلغ الخصم للحجز الواحد بالقروش (0 أو غائب = بلا سقف). */
  maxDiscountCents?: number
}

/** الكوبون الكامل كما يُخزَّن (يُضيف `lib/coupons` السجل والتواريخ على هذه القاعدة). */
export type CouponRuleLike = CouponLike & {
  maxUses?: number
  maxUsesPerCustomer?: number
  usedCount?: number
  scope?: CouponScope
  startsAt?: string
  endsAt?: string
  status?: CouponStatus
}

/** سياق التحقق/التطبيق: أي عرض وفرقة ومسرح وأي عميل. */
export type CouponContext = {
  eventId?: number
  troupeId?: number
  venueId?: number
  customerId?: string
  /** عدد مرات استخدام هذا العميل للكود (من سجل الاستخدام). */
  customerUses?: number
}

export type CouponValidationReason =
  | "empty"
  | "unknown"
  | "disabled"
  | "expired"
  | "not_started"
  | "exhausted"
  | "out_of_scope"
  | "customer_limit"

export type CouponValidation = {
  ok: boolean
  message: string
  reason?: CouponValidationReason
}

/** الشكل الكامل للسعر بعد الكوبون — يُغذّي كل مواضع العرض في الواجهة. */
export type CouponPriceShape = {
  /** كود الكوبون المطبَّق (فارغ لو لا يوجد). */
  couponCode: string
  couponLabel: string
  originalSubtotalCents: number
  discountCents: number
  discountedSubtotalCents: number
  /** النسبة الفعلية بعد التقريب والسقف (قد تختلف عن نسبة الكوبون). */
  discountPctApplied: number
  /** رسوم الخدمة لولا الكوبون — تُعرض مشطوبة. */
  serviceFeeOriginalCents: number
  serviceFeeCents: number
  serviceFeeSavingCents: number
  serviceFeeWaived: boolean
  serviceFeeMode: ServiceFeeMode
  /** بادج السعر: `-51%` أو `FREE`. */
  badgeLabel: string
  /** بادج رسوم الخدمة: `مجانًا` أو `-51%` أو فراغ. */
  serviceFeeBadge: string
  totalCents: number
  isFree: boolean
  /** هل يوجد أي خصم فعلي (تذاكر أو رسوم)؟ */
  hasDiscount: boolean
}

/** يقرّب مبلغًا بالقروش لأقرب **جنيه صحيح** (1 جنيه = 100 قرش). */
export function roundToWholeEgp(cents: number): number {
  if (!Number.isFinite(cents)) return 0
  return Math.round(cents / 100) * 100
}

/** يحصر نسبة مئوية في المدى 0..100 (وأي قيمة غير رقمية تصبح صفرًا). */
export function clampPercent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

/** مبلغ الخصم بالقروش قبل التقريب لأقرب جنيه، مع احترام سقف الخصم. */
export function couponDiscountCents(
  originalSubtotalCents: number,
  coupon: CouponLike | null | undefined,
): number {
  if (!coupon) return 0
  const subtotal = Number.isFinite(originalSubtotalCents) ? Math.max(0, originalSubtotalCents) : 0
  if (subtotal === 0) return 0
  const pct = clampPercent(coupon.discountPct)
  if (pct === 0) return 0

  const raw = Math.round((subtotal * pct) / 100)
  const cap =
    Number.isFinite(coupon.maxDiscountCents) && (coupon.maxDiscountCents ?? 0) > 0
      ? Math.round(coupon.maxDiscountCents as number)
      : Number.POSITIVE_INFINITY
  return Math.max(0, Math.min(raw, cap, subtotal))
}

/** بادج السعر: «FREE» للمجاني، وإلا نسبة الخصم المطبَّقة. */
export function couponBadgeLabel(priceShape: {
  isFree: boolean
  discountPctApplied: number
  serviceFeeWaived: boolean
  serviceFeeSavingCents: number
}): string {
  if (priceShape.isFree) return "FREE"
  if (priceShape.discountPctApplied > 0) return `-${priceShape.discountPctApplied}%`
  if (priceShape.serviceFeeWaived && priceShape.serviceFeeSavingCents > 0) return "رسوم الخدمة مجانًا"
  return ""
}

/**
 * يحسب شكل السعر الكامل لاختيار مقاعد/فئات بعد تطبيق كوبون.
 * تُمرَّر أسعار الوحدات (سعر الفئة لكل مقعد) — أو قيمة واحدة = المجموع الفرعي الجاهز.
 */
export function couponPriceShape(
  seatPrices: number[],
  coupon: CouponLike | null | undefined,
): CouponPriceShape {
  const prices = Array.isArray(seatPrices) ? seatPrices : []
  const originalSubtotalCents = prices.reduce(
    (sum, price) => sum + (Number.isFinite(price) ? price : 0),
    0,
  )

  // بلا كوبون: نفس أرقام `calculateTotals` حرفيًا (بلا أي تقريب) ⇒ صفر انحدار.
  if (!coupon) {
    const serviceFeeCents = calculateServiceFee(originalSubtotalCents)
    return {
      couponCode: "",
      couponLabel: "",
      originalSubtotalCents,
      discountCents: 0,
      discountedSubtotalCents: originalSubtotalCents,
      discountPctApplied: 0,
      serviceFeeOriginalCents: serviceFeeCents,
      serviceFeeCents,
      serviceFeeSavingCents: 0,
      serviceFeeWaived: false,
      serviceFeeMode: "none",
      badgeLabel: "",
      serviceFeeBadge: "",
      totalCents: originalSubtotalCents + serviceFeeCents,
      isFree: originalSubtotalCents + serviceFeeCents === 0,
      hasDiscount: false,
    }
  }

  const rawDiscount = couponDiscountCents(originalSubtotalCents, coupon)
  const discountedSubtotalCents = roundToWholeEgp(originalSubtotalCents - rawDiscount)
  // نحافظ على المعادلة: الأصلي = الخصم + المخفَّض (بالضبط) حتى لو كان المجموع كسورًا.
  const discountCents = originalSubtotalCents - discountedSubtotalCents
  const discountPctApplied =
    originalSubtotalCents > 0 ? Math.round((discountCents / originalSubtotalCents) * 100) : 0

  // الرسوم تُحسب على المبلغ **بعد** خصم التذاكر، وتُقرَّب لجنيه صحيح.
  const baseFeeCents = roundToWholeEgp(calculateServiceFee(discountedSubtotalCents))
  /**
   * «رسوم الخدمة لولا الكوبون» — تُعرض مشطوبة:
   *  - عادةً هي رسوم المبلغ بعد خصم التذاكر (قبل خصم الخدمة نفسه).
   *  - ولو صار المبلغ صفرًا (كوبون 100%) نعرض رسوم السعر الأصلي كاملًا حتى يبان
   *    الفرق بوضوح: «رسوم الخدمة ~~10 ج.م~~ مجانًا».
   */
  const serviceFeeOriginalCents =
    baseFeeCents > 0 ? baseFeeCents : roundToWholeEgp(calculateServiceFee(originalSubtotalCents))
  const discountRatio = originalSubtotalCents > 0 ? discountCents / originalSubtotalCents : 0

  let serviceFeeCents = baseFeeCents
  if (coupon.serviceFeeMode === "waived") serviceFeeCents = 0
  else if (coupon.serviceFeeMode === "same") {
    serviceFeeCents = roundToWholeEgp(baseFeeCents * (1 - discountRatio))
  }

  serviceFeeCents = Math.max(0, Math.min(serviceFeeCents, serviceFeeOriginalCents))
  const serviceFeeSavingCents = Math.max(0, serviceFeeOriginalCents - serviceFeeCents)
  const serviceFeeWaived = coupon.serviceFeeMode === "waived" && serviceFeeOriginalCents > 0
  const totalCents = discountedSubtotalCents + serviceFeeCents

  return {
    couponCode: coupon.code,
    couponLabel: coupon.label ?? "",
    originalSubtotalCents,
    discountCents,
    discountedSubtotalCents,
    discountPctApplied,
    serviceFeeOriginalCents,
    serviceFeeCents,
    serviceFeeSavingCents,
    serviceFeeWaived,
    serviceFeeMode: coupon.serviceFeeMode,
    badgeLabel: couponBadgeLabel({
      isFree: totalCents === 0,
      discountPctApplied,
      serviceFeeWaived,
      serviceFeeSavingCents,
    }),
    serviceFeeBadge: serviceFeeWaived
      ? "مجانًا"
      : serviceFeeSavingCents > 0 && serviceFeeOriginalCents > 0
        ? `-${Math.round((serviceFeeSavingCents / serviceFeeOriginalCents) * 100)}%`
        : "",
    totalCents,
    isFree: totalCents === 0,
    hasDiscount: discountCents > 0 || serviceFeeSavingCents > 0,
  }
}

/* ---------- التحقق من صلاحية الكوبون (قواعد نقية) ---------- */

function matchesScope(scope: CouponScope | undefined, context: CouponContext): boolean {
  if (!scope || scope.kind === "all") return true
  const ids = Array.isArray(scope.ids) ? scope.ids : []
  if (ids.length === 0) return true
  const candidates: (number | undefined)[] =
    scope.kind === "event" ? [context.eventId] : scope.kind === "troupe" ? [context.troupeId] : [context.venueId]
  // بدون معرّف في السياق لا يمكن إثبات الشمول ⇒ نرفض (الأكثر أمانًا).
  return candidates.some((value) => typeof value === "number" && ids.includes(value))
}

/** هل ينطبق نطاق الكوبون على هذا السياق (عرض/فرقة/مسرح)؟ */
export function couponScopeMatches(scope: CouponScope | undefined, context: CouponContext = {}): boolean {
  return matchesScope(scope, context)
}

/** عدد الاستخدامات المتبقية (بلا حد = Infinity). */
export function remainingCouponUses(coupon: Pick<CouponRuleLike, "maxUses" | "usedCount">): number {
  const max = Number.isFinite(coupon.maxUses) ? Math.max(0, Math.floor(coupon.maxUses as number)) : 0
  if (max === 0) return Number.POSITIVE_INFINITY
  return Math.max(0, max - Math.max(0, Math.floor(coupon.usedCount ?? 0)))
}

/**
 * قواعد قبول الكوبون: معطّل / لم يبدأ / منتهي / استُهلك / خارج النطاق / تجاوز حد العميل.
 * تُستدعى من `lib/coupons` (المخزن) ومن السيرفر في مسار الحجز.
 */
export function validateCouponRules(
  coupon: CouponRuleLike | null | undefined,
  context: CouponContext = {},
  now: Date = new Date(),
): CouponValidation {
  if (!coupon || typeof coupon.code !== "string" || coupon.code.trim().length === 0) {
    return { ok: false, message: "أدخل كود الكوبون.", reason: "empty" }
  }

  if (coupon.status === "disabled") {
    return { ok: false, message: "هذا الكوبون موقوف من إدارة كواليس.", reason: "disabled" }
  }
  if (coupon.status === "expired") {
    return { ok: false, message: "انتهت صلاحية هذا الكوبون.", reason: "expired" }
  }
  if (coupon.status === "exhausted") {
    return { ok: false, message: "استُهلك هذا الكوبون بالكامل.", reason: "exhausted" }
  }

  const startsAt = coupon.startsAt ? new Date(coupon.startsAt) : null
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > now.getTime()) {
    return { ok: false, message: "هذا الكوبون لم يبدأ بعد.", reason: "not_started" }
  }

  const endsAt = coupon.endsAt ? new Date(coupon.endsAt) : null
  if (endsAt && !Number.isNaN(endsAt.getTime()) && now.getTime() > endsAt.getTime()) {
    return { ok: false, message: "انتهت صلاحية هذا الكوبون.", reason: "expired" }
  }

  if (remainingCouponUses(coupon) <= 0) {
    return { ok: false, message: "استُهلك هذا الكوبون بالكامل.", reason: "exhausted" }
  }

  const perCustomer = Number.isFinite(coupon.maxUsesPerCustomer)
    ? Math.max(0, Math.floor(coupon.maxUsesPerCustomer as number))
    : 0
  if (perCustomer > 0 && Math.max(0, Math.floor(context.customerUses ?? 0)) >= perCustomer) {
    return {
      ok: false,
      message:
        perCustomer === 1
          ? "هذا الكوبون مستخدَم بالفعل بحسابك."
          : `وصلت للحد الأقصى (${perCustomer}) لاستخدام هذا الكوبون.`,
      reason: "customer_limit",
    }
  }

  if (!matchesScope(coupon.scope, context)) {
    return { ok: false, message: "هذا الكوبون غير ساري على هذا العرض.", reason: "out_of_scope" }
  }

  return { ok: true, message: `كوبون ${coupon.code} صالح ✓` }
}

/* ---------- لقطة الكوبون للتخزين مع التذكرة ---------- */

export type CouponSnapshot = {
  code: string
  label?: string
  discountPct: number
  serviceFeeMode: ServiceFeeMode
  /** الإجمالي لولا الكوبون (بالقروش). */
  originalTotalCents: number
  discountCents: number
  serviceFeeSavingCents: number
}

/**
 * يبني لقطة كوبون من «شكل السعر» — تُخزَّن مع التذكرة حتى يظل عرض الخصم
 * (السعر المشطوب + رسوم الخدمة المجانية) صحيحًا بعد انتهاء الحملة.
 */
export function couponSnapshotFromShape(shape: CouponPriceShape, label = ""): CouponSnapshot {
  return {
    code: shape.couponCode,
    label: label || shape.couponLabel || undefined,
    discountPct: shape.discountPctApplied,
    serviceFeeMode: shape.serviceFeeMode,
    originalTotalCents: shape.originalSubtotalCents + shape.serviceFeeOriginalCents,
    discountCents: shape.discountCents,
    serviceFeeSavingCents: shape.serviceFeeSavingCents,
  }
}

/**
 * يوزّع مبلغًا مخفَّضًا على أسعار المقاعد تناسبيًا (نفس نسبة الخصم لكل مقعد)،
 * وفروق التقريب تُوضع على المقعد الأخير — فيساوي **مجموع** القيم المُعادة
 * `discountedTotalCents` بالضبط (مهم لسجل الحجز ومحفظة الفرقة).
 */
export function distributeDiscount(prices: number[], discountedTotalCents: number): number[] {
  const safePrices = Array.isArray(prices) ? prices.map((price) => (Number.isFinite(price) ? Math.max(0, price) : 0)) : []
  const total = safePrices.reduce((sum, price) => sum + price, 0)
  if (safePrices.length === 0) return []
  if (total <= 0) return safePrices.map(() => 0)

  const target = Math.max(0, Math.min(Math.round(discountedTotalCents), total))
  const ratio = target / total
  const out: number[] = []
  let allocated = 0

  safePrices.forEach((price, index) => {
    const isLast = index === safePrices.length - 1
    const value = isLast ? target - allocated : Math.max(0, Math.floor(price * ratio))
    out.push(value)
    allocated += value
  })

  return out
}



