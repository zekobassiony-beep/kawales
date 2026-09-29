"use client"

import { useMemo, useState } from "react"
import { Plus, RotateCcw, Sparkles, TicketPercent, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { couponPriceShape, type ServiceFeeMode } from "@/lib/coupon-pricing"
import { useSession } from "@/lib/session"
import {
  COUPON_QUICK_PERCENTS,
  FREE_FESTIVAL_PRESET,
  SERVICE_FEE_MODE_LABELS,
  couponStats,
  createCoupon,
  resetCoupons,
  useCoupons,
} from "@/lib/coupons"
import { CouponTotals } from "@/components/coupon-price"
import { CouponTable } from "@/app/hq-kawalees/coupon-center-parts"

/**
 * مركز الكوبونات (Coupon Center) — Dark Graphite & Gold.
 *
 * السوبر أدمن يولّد الكود بنفسه ويحدّد **نسبة الخصم** و**وضع رسوم الخدمة**
 * (بلا / نفس النسبة / إعفاء كامل = Free)، مع **معاينة حية** تُظهر شكل الخصم
 * بالحرف كما سيراه الزائر، وزر جاهز «كوبون مهرجان مجاني» (100% + إعفاء رسوم).
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-colors"
const FIELD =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"
const GOLD_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"

/** أسعار تجريبية للمعاينة الحية لشكل الخصم. */
const PREVIEW_PRICES = [
  { label: "100 ج.م", cents: 10000 },
  { label: "150 ج.م", cents: 15000 },
  { label: "200 ج.م", cents: 20000 },
]

/** يحوّل تاريخ الإدخال إلى نهاية اليوم (23:59:59) بتوقيت الجهاز. */
function endOfDayIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function emptyDraft() {
  return {
    label: "",
    code: "",
    discountPct: FREE_FESTIVAL_PRESET.discountPct,
    serviceFeeMode: FREE_FESTIVAL_PRESET.serviceFeeMode as ServiceFeeMode,
    maxUses: 0,
    maxUsesPerCustomer: FREE_FESTIVAL_PRESET.maxUsesPerCustomer,
    maxDiscountEgp: 0,
    endsAt: "",
  }
}

export function CouponCenter() {
  const session = useSession()
  const state = useCoupons()
  const stats = couponStats(state)
  const [draft, setDraft] = useState(emptyDraft)
  const [sampleCents, setSampleCents] = useState(15000)
  const [notice, setNotice] = useState<string | null>(null)

  /** المعاينة الحية: نفس دالة الحساب التي يعمل بها مسار الحجز. */
  const previewShape = useMemo(
    () =>
      couponPriceShape([sampleCents], {
        code: draft.code.trim().toUpperCase() || "PREVIEW",
        label: draft.label,
        discountPct: draft.discountPct,
        serviceFeeMode: draft.serviceFeeMode,
        maxDiscountCents: draft.maxDiscountEgp > 0 ? draft.maxDiscountEgp * 100 : 0,
      }),
    [draft, sampleCents],
  )

  const patch = (value: Partial<ReturnType<typeof emptyDraft>>) => setDraft({ ...draft, ...value })

  /** الإعداد الجاهز للمهرجان المجاني: خصم 100% + رسوم الخدمة مجانًا. */
  const applyFreeFestivalPreset = () => {
    patch({
      discountPct: FREE_FESTIVAL_PRESET.discountPct,
      serviceFeeMode: FREE_FESTIVAL_PRESET.serviceFeeMode,
      maxUsesPerCustomer: FREE_FESTIVAL_PRESET.maxUsesPerCustomer,
      label: draft.label.trim() || "مهرجان مجاني — دخول الفرق المشاركة",
    })
    setNotice("تم تجهيز إعدادات المهرجان المجاني: خصم 100% + رسوم الخدمة مجانًا — راجع المعاينة ثم اضغط «إنشاء الكوبون».")
  }

  const submit = () => {
    const created = createCoupon({
      label: draft.label,
      code: draft.code,
      discountPct: draft.discountPct,
      serviceFeeMode: draft.serviceFeeMode,
      maxUses: draft.maxUses,
      maxUsesPerCustomer: draft.maxUsesPerCustomer,
      maxDiscountCents: draft.maxDiscountEgp > 0 ? draft.maxDiscountEgp * 100 : 0,
      endsAt: endOfDayIso(draft.endsAt),
      createdBy: session?.email ?? "",
    })
    if (!created) {
      setNotice("تعذّر الإنشاء: اكتب اسم حملة (حرفان على الأقل) وكودًا غير مكرر (4 أحرف على الأقل).")
      return
    }
    setNotice(`تم إنشاء الكوبون ${created.code} — جاهز الآن للاستخدام في صفحة الحجز.`)
    setDraft(emptyDraft())
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <TicketPercent className="h-4 w-4" />
          </span>
          كوبونات الخصم
        </h2>
        <p className="mt-1.5 text-xs text-zinc-400">
          أنت من يطلق الكوبون: حدّد نسبة الخصم وهل يشمل <span className="font-semibold text-amber-400">رسوم الخدمة</span>{" "}
          (10% بحد أدنى 5 ج.م) — فيبان للزائر السعر الأصلي مشطوبًا بجانب السعر الجديد، ورسوم الخدمة «مجانًا» عند الإعفاء.
        </p>
      </div>

      {/* شبكة KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "إجمالي الكوبونات", value: String(stats.total), hint: `${stats.redemptions} عملية استخدام` },
          { label: "كوبونات نشِطة", value: String(stats.active), hint: `${stats.disabled} موقوف` },
          { label: "كوبونات مستهلكة", value: String(state.coupons.filter((item) => item.usedCount > 0).length), hint: `من ${stats.total}` },
          {
            label: "إجمالي التوفير",
            value: formatPrice(stats.totalDiscountCents + stats.totalServiceFeeSavingCents),
            hint: `رسوم خدمة مُعفاة: ${formatPrice(stats.totalServiceFeeSavingCents)}`,
          },
        ].map((card) => (
          <div key={card.label} className={cn(CARD, "p-5 hover:border-amber-500/30")}>
            <p className="text-xs font-medium text-zinc-400">{card.label}</p>
            <p className="mt-1 font-serif text-3xl font-bold text-amber-400">{card.value}</p>
            <p className="mt-1.5 text-[11px] text-zinc-500">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* كارت إنشاء الكوبون */}
      <div className={cn(CARD, "space-y-4 p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
            <Sparkles className="h-4 w-4 text-amber-400" />
            إنشاء كوبون جديد
          </h3>
          <button
            type="button"
            onClick={applyFreeFestivalPreset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <Wand2 className="h-3.5 w-3.5" />
            كوبون مهرجان مجاني (100% + رسوم الخدمة مجانًا)
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-zinc-400">
            اسم الحملة *
            <input
              value={draft.label}
              onChange={(event) => patch({ label: event.target.value })}
              placeholder="مثال: مهرجان الطليعة 2026"
              className={cn(FIELD, "mt-1.5")}
            />
          </label>
          <label className="text-xs text-zinc-400">
            الكود (اتركه فارغًا للتوليد التلقائي)
            <input
              value={draft.code}
              onChange={(event) => patch({ code: event.target.value.toUpperCase() })}
              placeholder="FEST-2026-X8Y"
              dir="ltr"
              className={cn(FIELD, "mt-1.5 font-mono")}
            />
          </label>
          <label className="text-xs text-zinc-400">
            ينتهي بتاريخ (اختياري)
            <input
              type="date"
              value={draft.endsAt}
              onChange={(event) => patch({ endsAt: event.target.value })}
              className={cn(FIELD, "mt-1.5")}
            />
          </label>
        </div>

        {/* نسبة الخصم */}
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-300">نسبة الخصم على التذاكر</span>
            <span className="font-serif text-2xl font-bold text-amber-400">{draft.discountPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draft.discountPct}
            onChange={(event) => patch({ discountPct: Number(event.target.value) })}
            className="w-full accent-amber-500"
            aria-label="نسبة الخصم"
          />
          <div className="flex flex-wrap items-center gap-2">
            {COUPON_QUICK_PERCENTS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => patch({ discountPct: pct })}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  draft.discountPct === pct
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60",
                )}
              >
                {pct}%
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={100}
              value={draft.discountPct}
              onChange={(event) => patch({ discountPct: Number(event.target.value) })}
              className={cn(FIELD, "w-24 py-1 text-center")}
              dir="ltr"
              aria-label="نسبة الخصم يدويًا"
            />
          </div>
        </div>

        {/* وضع رسوم الخدمة — أهم مفتاح في الطلب */}
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-xs font-semibold text-zinc-300">
            رسوم الخدمة (10% بحد أدنى 5 ج.م) — هل يشملها الخصم؟
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(SERVICE_FEE_MODE_LABELS) as ServiceFeeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => patch({ serviceFeeMode: mode })}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-right text-[11px] font-semibold transition-colors",
                  draft.serviceFeeMode === mode
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60",
                )}
              >
                {SERVICE_FEE_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* الحدود */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-400">
            أقصى عدد استخدامات (0 = بلا حد)
            <input
              type="number"
              min={0}
              value={draft.maxUses}
              onChange={(event) => patch({ maxUses: Number(event.target.value) })}
              className={cn(FIELD, "mt-1.5")}
              dir="ltr"
            />
          </label>
          <label className="text-xs text-zinc-400">
            أقصى استخدام للعميل الواحد (0 = بلا حد)
            <input
              type="number"
              min={0}
              value={draft.maxUsesPerCustomer}
              onChange={(event) => patch({ maxUsesPerCustomer: Number(event.target.value) })}
              className={cn(FIELD, "mt-1.5")}
              dir="ltr"
            />
          </label>
          <label className="text-xs text-zinc-400">
            سقف مبلغ الخصم بالجنيه (0 = بلا سقف)
            <input
              type="number"
              min={0}
              value={draft.maxDiscountEgp}
              onChange={(event) => patch({ maxDiscountEgp: Number(event.target.value) })}
              className={cn(FIELD, "mt-1.5")}
              dir="ltr"
            />
          </label>
        </div>

        {/* المعاينة الحية لشكل الخصم + زر الإنشاء */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-300">المعاينة الحية — كما سيراه الزائر</p>
              <div className="flex flex-wrap gap-1.5">
                {PREVIEW_PRICES.map((price) => (
                  <button
                    key={price.cents}
                    type="button"
                    onClick={() => setSampleCents(price.cents)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                      sampleCents === price.cents
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                        : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60",
                    )}
                  >
                    {price.label}
                  </button>
                ))}
              </div>
            </div>
            <CouponTotals shape={previewShape} />
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="space-y-2 text-[11px] text-zinc-400">
              <p className="font-semibold text-zinc-300">ملخص الإعداد</p>
              <p>
                الخصم: <span className="font-bold text-amber-400">{draft.discountPct}%</span> على التذاكر
              </p>
              <p>
                رسوم الخدمة: <span className="font-bold text-emerald-300">{SERVICE_FEE_MODE_LABELS[draft.serviceFeeMode]}</span>
              </p>
              <p>
                الاستخدام: {draft.maxUses > 0 ? `${draft.maxUses} مرة` : "بلا حد"}
                {draft.maxUsesPerCustomer > 0 ? ` · ${draft.maxUsesPerCustomer} لكل عميل` : ""}
              </p>
              <p>النطاق: كل العروض (المحرك يدعم تحديد عرض/فرقة/مسرح — يُربط بالعروض لاحقًا).</p>
            </div>
            <button type="button" onClick={submit} className={cn(GOLD_BTN, "w-full")}>
              <Plus className="h-4 w-4" />
              إنشاء الكوبون
            </button>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 backdrop-blur"
          >
            {notice}
          </p>
        )}
      </div>

      <CouponTable onNotice={setNotice} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-[11px] text-zinc-500">
          ملاحظة: الكوبونات تُخزَّن الآن في متصفح المنصة (نفس نمط باقي أقسام غرفة العمليات). لتشغيلها لكل
          الزوار من أي جهاز يُنقل المخزن إلى جدول <code className="font-mono">public.coupons</code> بدون تغيير أي شاشة.
        </p>
        <button
          type="button"
          onClick={() => {
            resetCoupons()
            setNotice("تم استرجاع الكوبونات الافتراضية.")
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          استرجاع الافتراضي
        </button>
      </div>
    </div>
  )
}

