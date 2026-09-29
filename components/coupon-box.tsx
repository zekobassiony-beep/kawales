"use client"

import { useState } from "react"
import { BadgeCheck, TicketPercent, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/session"
import { useCoupons, validateCoupon, type Coupon, type CouponContext } from "@/lib/coupons"

/**
 * خانة «عندك كوبون؟» — يُدخل الزائر الكود فيُتحقق منه (`lib/coupons:validateCoupon`)
 * ثم يُطبَّق على الأسعار في صندوق الحجز مباشرة، فيظهر «شكل الخصم» على السعر
 * ورسوم الخدمة معًا (`components/coupon-price.tsx`).
 */

export function CouponBox({
  context,
  applied,
  onApply,
  onClear,
  className,
  /** كود تجريبي يظهر كتلميحة (من بيانات المنصة الأولية). */
  hintCode = "",
}: {
  context: CouponContext
  applied: Coupon | null
  onApply: (coupon: Coupon) => void
  onClear: () => void
  className?: string
  hintCode?: string
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * تلميحة الكود: أول كوبون نشِط فعليًا في المنصة (مفيد في العرض التجريبي).
   * تُقرأ من المخزن في المتصفح فلا تظهر على السيرفر (تجنّب اختلاف الترطيب).
   */
  const { coupons } = useCoupons()
  const suggestedCode =
    hintCode ||
    coupons.find((item) => item.status === "active" && item.discountPct > 0)?.code ||
    ""

  // هوية العميل مطلوبة لحدّ «استخدام واحد للعميل» (maxUsesPerCustomer).
  const session = useSession()
  const fullContext: CouponContext = { ...context, customerId: context.customerId || session?.email || "" }

  const submit = () => {
    const result = validateCoupon(code, fullContext)
    if (!result.ok || !result.coupon) {
      setNotice(null)
      setError(result.message)
      return
    }
    setError(null)
    setNotice(`تم تطبيق كوبون ${result.coupon.code} — خصم ${result.coupon.discountPct}%`)
    setCode("")
    onApply(result.coupon)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {applied ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
          <span className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-300">
            <BadgeCheck className="h-3.5 w-3.5" />
            كوبون مُطبَّق
            <span className="font-mono" dir="ltr">
              {applied.code}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onClear()
              setNotice(null)
              setError(null)
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-3 w-3" />
            إزالة الكوبون
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <TicketPercent className="h-3.5 w-3.5 text-amber-400" />
              عندك كوبون؟
            </span>
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder="أدخل كود الخصم"
              dir="ltr"
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs uppercase outline-none transition-colors focus:border-amber-500"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={code.trim().length === 0}
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
          >
            تطبيق
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </p>
      )}
      {!error && notice && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          {notice}
        </p>
      )}
      {!applied && !error && suggestedCode.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          كوبون متاح للتجربة:{" "}
          <button
            type="button"
            onClick={() => setCode(suggestedCode.toUpperCase())}
            className="font-mono text-amber-400 underline-offset-2 hover:underline"
            dir="ltr"
          >
            {suggestedCode}
          </button>
        </p>
      )}
    </div>
  )
}
