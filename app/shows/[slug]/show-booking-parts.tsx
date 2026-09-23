"use client"

import { useState } from "react"
import { BellRing, Mail, Minus, Phone, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { metalForTier, type BookingTierLike } from "@/lib/show-detail"

/** أجزاء صندوق الحجز: كارت الفئة المعدني · صف الكمية · كروت الانتظار والتواصل. */

export const SIDEBAR_CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

/** كارت فئة تذكرة (اختيار) ببادج معدني وتوهج عند الاختيار. */
export function TierOption({
  tier,
  index,
  active,
  remaining,
  onSelect,
}: {
  tier: BookingTierLike
  index: number
  active: boolean
  remaining: number
  onSelect: () => void
}) {
  const metal = metalForTier(tier.name, index)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-right transition-all",
        active ? cn("bg-zinc-900/90", metal.glowClass) : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", metal.dotClass)} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-100">{tier.name}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", metal.badgeClass)}>{metal.label}</span>
          </span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">{remaining} تذكرة متبقية</span>
        </span>
      </span>
      <span className="shrink-0 font-serif text-sm font-bold text-amber-400">{formatPrice(tier.priceCents)}</span>
    </button>
  )
}

/** صف عداد الكمية + الحساب الفوري + رسالة خصم الشلة. */
export function QuantityRow({
  quantity,
  maxQuantity,
  unitCents,
  totalCents,
  discountPct,
  savingsCents,
  onChange,
}: {
  quantity: number
  maxQuantity: number
  unitCents: number
  totalCents: number
  discountPct: number
  savingsCents: number
  onChange: (quantity: number) => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">عدد التذاكر</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            aria-label="تقليل"
            disabled={quantity <= 1}
            onClick={() => onChange(Math.max(1, quantity - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center font-serif text-lg font-bold text-zinc-100">{quantity}</span>
          <button
            type="button"
            aria-label="زيادة"
            disabled={quantity >= maxQuantity}
            onClick={() => onChange(quantity + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
        <span className="font-mono text-[11px] text-zinc-500" dir="ltr">
          {quantity} × {formatPrice(unitCents)}
        </span>
        <span className="font-serif text-lg font-bold text-amber-400">{formatPrice(totalCents)}</span>
      </div>

      {discountPct > 0 && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          خصم الشلة {discountPct}% مُطبَّق — وفّرت {formatPrice(savingsCents)}
        </p>
      )}
    </div>
  )
}

/** كارت قائمة الانتظار + التواصل مع المنظم. */
export function ShowSidebarExtras({
  organizer,
  initialWaitlist,
}: {
  organizer: { phone: string; email: string }
  initialWaitlist: number
}) {
  const [waitlist, setWaitlist] = useState(initialWaitlist)
  const [joined, setJoined] = useState(false)

  return (
    <div className="mt-4 space-y-4">
      <div className={cn(SIDEBAR_CARD, "p-5")}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <BellRing className="h-4 w-4 text-amber-400" />
          بلّغني لو كراسي فضيت
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{waitlist} شخص في قائمة الانتظار حاليًا.</p>
        <button
          type="button"
          disabled={joined}
          onClick={() => {
            setWaitlist((current) => current + 1)
            setJoined(true)
          }}
          className={cn(
            "mt-3 w-full rounded-xl px-4 py-2.5 text-xs font-bold transition-colors",
            joined
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500 text-zinc-950 hover:bg-amber-400",
          )}
        >
          {joined ? "تم تسجيلك في القائمة ✓" : "سجّل في قائمة الانتظار"}
        </button>
      </div>

      <div className={cn(SIDEBAR_CARD, "p-5")}>
        <p className="text-sm font-semibold text-zinc-100">تواصل مع المنظم</p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-400">
          <li>
            <a className="inline-flex items-center gap-1.5 hover:text-amber-300" href={`tel:${organizer.phone}`} dir="ltr">
              <Phone className="h-3.5 w-3.5" />
              {organizer.phone}
            </a>
          </li>
          <li>
            <a className="inline-flex items-center gap-1.5 hover:text-amber-300" href={`mailto:${organizer.email}`} dir="ltr">
              <Mail className="h-3.5 w-3.5" />
              {organizer.email}
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
