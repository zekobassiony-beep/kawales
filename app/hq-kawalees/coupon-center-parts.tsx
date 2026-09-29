"use client"

import { BadgeCheck, Copy, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  COUPON_SCOPE_LABELS,
  COUPON_STATUS_LABELS,
  COUPON_STATUS_TONES,
  SERVICE_FEE_MODE_LABELS,
  couponRemainingUses,
  couponStats,
  removeCoupon,
  setCouponStatus,
  useCoupons,
  type Coupon,
} from "@/lib/coupons"

/**
 * جدول تتبّع الكوبونات — Dark Graphite & Gold
 * (نفس منطق أزرار أكواد الدعوة: نسخ / إيقاف-تفعيل / حذف).
 */

const SMALL_BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors"

/** خلية «قيمة الخصم»: النسبة + وضع رسوم الخدمة. */
function DiscountCell({ discountPct, serviceFeeMode }: { discountPct: number; serviceFeeMode: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-serif text-sm font-bold text-amber-400">{discountPct}%</p>
      <p className="text-[10px] text-zinc-500">
        {SERVICE_FEE_MODE_LABELS[serviceFeeMode as keyof typeof SERVICE_FEE_MODE_LABELS] ?? "—"}
      </p>
    </div>
  )
}

export function CouponTable({ onNotice }: { onNotice: (text: string) => void }) {
  const { coupons, redemptions } = useCoupons()
  const stats = couponStats({ coupons, redemptions })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-zinc-100">كل الكوبونات ({coupons.length})</h3>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
          إجمالي ما وفّره الجمهور: {formatPrice(stats.totalDiscountCents + stats.totalServiceFeeSavingCents)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-right text-xs text-zinc-400">
              <th className="px-4 py-3 font-medium">الكود</th>
              <th className="px-4 py-3 font-medium">الحملة</th>
              <th className="px-4 py-3 font-medium">الخصم</th>
              <th className="px-4 py-3 font-medium">الاستخدام</th>
              <th className="px-4 py-3 font-medium">الصلاحية</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((item) => (
              <CouponRow key={item.code} item={item} onNotice={onNotice} />
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-zinc-500">
                  لا توجد كوبونات بعد — ولّد كوبونًا من الأعلى.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** صف كوبون واحد في الجدول. */
function CouponRow({ item, onNotice }: { item: Coupon; onNotice: (text: string) => void }) {
  const remaining = couponRemainingUses(item)
  const exhausted = remaining <= 0

  return (
    <tr className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
      <td className="px-4 py-3 font-mono text-xs text-amber-400" dir="ltr">
        {item.code}
      </td>
      <td className="px-4 py-3 text-xs text-zinc-300">
        <span className="block font-semibold">{item.label}</span>
        <span className="block text-[10px] text-zinc-500">
          {COUPON_SCOPE_LABELS[item.scope.kind]}
          {item.note ? ` · ${item.note}` : ""}
        </span>
      </td>
      <td className="px-4 py-3">
        <DiscountCell discountPct={item.discountPct} serviceFeeMode={item.serviceFeeMode} />
      </td>
      <td className="px-4 py-3 text-xs text-zinc-300">
        <span className="block font-semibold">{item.usedCount} استخدام</span>
        <span className="block text-[10px] text-zinc-500">
          {Number.isFinite(remaining) ? `${remaining} متبقٍ` : "بلا حد"}
          {item.maxUsesPerCustomer > 0 ? ` · ${item.maxUsesPerCustomer} للعميل` : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] text-zinc-400">
        {item.endsAt ? `حتى ${new Date(item.endsAt).toLocaleDateString("ar-EG")}` : "بلا تاريخ انتهاء"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={exhausted ? "gray" : COUPON_STATUS_TONES[item.status]}>
          {exhausted ? "مستهلك" : COUPON_STATUS_LABELS[item.status]}
        </StatusBadge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-label={`نسخ ${item.code}`}
            onClick={() => {
              void navigator.clipboard.writeText(item.code).catch(() => undefined)
              onNotice(`تم نسخ الكود ${item.code}.`)
            }}
            className={cn(SMALL_BTN, "border-zinc-800 px-2 text-zinc-400 hover:bg-zinc-800/60")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          {item.status === "active" ? (
            <button
              type="button"
              onClick={() => {
                setCouponStatus(item.code, "disabled")
                onNotice(`تم إيقاف الكود ${item.code} — لن يُقبل في الحجز.`)
              }}
              className={cn(SMALL_BTN, "border-amber-500/40 text-amber-300 hover:bg-amber-500/10")}
            >
              <BadgeCheck className="h-3 w-3" />
              إيقاف
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCouponStatus(item.code, "active")
                onNotice(`تم تفعيل الكود ${item.code}.`)
              }}
              className={cn(SMALL_BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10")}
            >
              <BadgeCheck className="h-3 w-3" />
              تفعيل
            </button>
          )}
          <button
            type="button"
            aria-label={`حذف ${item.code}`}
            onClick={() => {
              removeCoupon(item.code)
              onNotice(`تم حذف الكود ${item.code}.`)
            }}
            className={cn(SMALL_BTN, "border-red-500/40 px-2 text-red-300 hover:bg-red-500/10")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
