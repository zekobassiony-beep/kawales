import { cn } from "@/lib/utils"
import { formatPrice, formatPriceLabel } from "@/lib/format"
import type { CouponPriceShape } from "@/lib/coupon-pricing"

/**
 * عرض «شكل الخصم» لأي سعر بعد كوبون — Dark Graphite & Gold:
 * السعر الأصلي **مشطوب** ثم السعر الجديد بجانبه، مع بادج النسبة (`-51%`) أو `FREE`،
 * وسطر مستقل لرسوم الخدمة يعرض «~~10 ج.م~~ مجانًا» عند الإعفاء.
 *
 * مكوّنات صرفة بلا حالة ⇒ تُستعمل في مكوّنات السيرفر والعميل معًا.
 */

const SIZE_CLASS = {
  sm: { original: "text-[11px]", final: "text-sm", badge: "text-[10px] px-1.5 py-0.5" },
  md: { original: "text-xs", final: "text-base", badge: "text-[10px] px-2 py-0.5" },
  lg: { original: "text-sm", final: "font-serif text-xl font-bold", badge: "text-[11px] px-2 py-0.5" },
  xl: { original: "text-base", final: "font-serif text-3xl font-bold", badge: "text-xs px-2.5 py-1" },
} as const

export function couponBadgeClass(shape: CouponPriceShape): string {
  if (shape.isFree) return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
  return "border-amber-500/50 bg-amber-500/15 text-amber-300"
}

/** بادج نسبة الخصم (`-51%` / `FREE`) — لا يُعرض إن لم يوجد خصم. */
export function CouponBadge({
  shape,
  size = "md",
  className,
}: {
  shape: CouponPriceShape
  size?: keyof typeof SIZE_CLASS
  className?: string
}) {
  if (shape.badgeLabel.length === 0) return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-bold",
        SIZE_CLASS[size].badge,
        couponBadgeClass(shape),
        className,
      )}
    >
      {shape.badgeLabel}
    </span>
  )
}

/**
 * السعر بشكل الخصم: `~~150 ج.م~~ 74 ج.م` + بادج، أو السعر المجاني بلون أخضر.
 * بدون خصم يعرض السعر الأصلي كما هو (بلا مشطوب ولا بادج).
 */
export function CouponPrice({
  shape,
  size = "md",
  className,
}: {
  shape: CouponPriceShape
  size?: keyof typeof SIZE_CLASS
  className?: string
}) {
  const sizes = SIZE_CLASS[size]

  if (!shape.hasDiscount || shape.discountCents <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-2 font-bold text-amber-400", sizes.final, className)}>
        {formatPriceLabel(shape.discountedSubtotalCents)}
      </span>
    )
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span className={cn("font-medium text-muted-foreground line-through", sizes.original)}>
        {formatPrice(shape.originalSubtotalCents)}
      </span>
      <span
        className={cn(
          "font-bold",
          sizes.final,
          shape.discountedSubtotalCents === 0 ? "text-emerald-400" : "text-amber-400",
        )}
      >
        {formatPriceLabel(shape.discountedSubtotalCents)}
      </span>
      <CouponBadge shape={shape} size={size} />
    </span>
  )
}

/** سطر رسوم الخدمة: «رسوم الخدمة ~~10 ج.م~~ مجانًا» (بلا مشطوب لو لا يوجد خصم على الرسوم). */
export function ServiceFeeRow({ shape, className }: { shape: CouponPriceShape; className?: string }) {
  const discounted = shape.serviceFeeSavingCents > 0
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-muted-foreground">
        رسوم الخدمة
        {shape.serviceFeeWaived && <span className="ms-1 text-[10px] font-semibold text-emerald-400">مُعفاة</span>}
      </span>
      <span className="inline-flex items-center gap-2">
        {discounted && (
          <span className="text-xs text-muted-foreground line-through">
            {formatPrice(shape.serviceFeeOriginalCents)}
          </span>
        )}
        <span
          className={cn(
            "font-semibold",
            shape.serviceFeeCents === 0 ? "text-emerald-400" : discounted ? "text-amber-300" : "text-foreground",
          )}
        >
          {formatPriceLabel(shape.serviceFeeCents)}
        </span>
        {shape.serviceFeeBadge.length > 0 && shape.serviceFeeCents > 0 && (
          <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
            {shape.serviceFeeBadge}
          </span>
        )}
      </span>
    </div>
  )
}

/** ملخص الحساب كاملًا بشكل الخصم: المجموع الفرعي · الخصم · رسوم الخدمة · الإجمالي. */
export function CouponTotals({
  shape,
  className,
  showSubtotal = true,
}: {
  shape: CouponPriceShape
  className?: string
  /** إخفاء سطر المجموع الفرعي عند عرض التفصيل خارج مكانه. */
  showSubtotal?: boolean
}) {
  const totalSaving = shape.discountCents + shape.serviceFeeSavingCents

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {showSubtotal && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">المجموع الفرعي</span>
          {shape.discountCents > 0 ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(shape.originalSubtotalCents)}
              </span>
              <span className="font-semibold text-foreground">{formatPrice(shape.discountedSubtotalCents)}</span>
            </span>
          ) : (
            <span className="font-semibold text-foreground">{formatPrice(shape.originalSubtotalCents)}</span>
          )}
        </div>
      )}

      {shape.discountCents > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-emerald-300">
            خصم الكوبون
            {shape.couponCode && (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px]" dir="ltr">
                {shape.couponCode}
              </span>
            )}
            {shape.discountPctApplied > 0 && <span className="text-[10px] font-bold">−{shape.discountPctApplied}%</span>}
          </span>
          <span className="font-semibold text-emerald-300">−{formatPrice(shape.discountCents)}</span>
        </div>
      )}

      <ServiceFeeRow shape={shape} />

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
        <span className="font-semibold text-foreground">الإجمالي</span>
        <span
          className={cn(
            "font-serif text-xl font-bold",
            shape.totalCents === 0 ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {formatPriceLabel(shape.totalCents)}
        </span>
      </div>

      {totalSaving > 0 && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          وفّرت {formatPrice(totalSaving)} مع هذا الكوبون ✓
        </p>
      )}
    </div>
  )
}

/** بادج صغير «كوبون … مطبَّق» لعرضه فوق صندوق الحجز أو في ملخص الدفع. */
export function CouponAppliedNote({ shape, className }: { shape: CouponPriceShape; className?: string }) {
  if (!shape.couponCode) return null
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300",
        className,
      )}
    >
      <span>كوبون مُطبَّق</span>
      <span className="font-mono" dir="ltr">
        {shape.couponCode}
      </span>
      {shape.discountPctApplied > 0 && <span>· خصم {shape.discountPctApplied}%</span>}
      {shape.serviceFeeWaived && <span>· رسوم الخدمة مجانًا</span>}
      {shape.isFree && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold">FREE 🎟️</span>}
    </p>
  )
}

