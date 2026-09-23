"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Gift, Share2, ShoppingBag, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { groupDiscount, occupancyInfo, type BookingTierLike } from "@/lib/show-detail"
import { QuantityRow, SIDEBAR_CARD, TierOption } from "@/app/shows/[slug]/show-booking-parts"

/**
 * صندوق حجز التذاكر المباشر (Sticky Sidebar) — Dark Graphite & Gold:
 * السعر المبدئي + شريط المتبقي + كروت الفئات المعدنية + عداد الكمية بحساب فوري
 * + زر «احجز دلوقتي» الذهبي + أزرار الهدية والمشاركة.
 */
export function ShowBookingBox({
  slug,
  title,
  tiers,
  capacity,
  sold,
  blockedReason,
}: {
  slug: string
  title: string
  tiers: BookingTierLike[]
  capacity: number
  sold: number
  blockedReason: string | null
}) {
  const occupancy = useMemo(() => occupancyInfo(sold, capacity), [sold, capacity])
  const [selectedId, setSelectedId] = useState(tiers[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)

  const selected = tiers.find((tier) => tier.id === selectedId) ?? tiers[0]
  const unitCents = selected?.priceCents ?? 0
  const deal = useMemo(() => groupDiscount(quantity, unitCents), [quantity, unitCents])

  const minPrice = Math.min(...tiers.map((tier) => tier.priceCents), 0)
  const soldOut = occupancy.remaining === 0
  const canBook = !blockedReason && !soldOut && tiers.length > 0
  const bookHref = `/shows/${slug}/book?tier=${encodeURIComponent(selected?.id ?? "")}&qty=${quantity}`

  return (
    <div className={cn(SIDEBAR_CARD, "overflow-hidden")}>
      <div className="border-b border-zinc-800 bg-gradient-to-l from-amber-500/10 via-transparent to-transparent p-5">
        <p className="text-xs text-zinc-400">يبدأ من</p>
        <p className="mt-1 font-serif text-3xl font-bold text-amber-400">
          {formatPrice(minPrice)}
          <span className="ms-1 text-sm font-normal text-zinc-500">/ تذكرة</span>
        </p>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className={cn("font-semibold", soldOut ? "text-red-400" : "text-amber-300")}>
              {soldOut ? "نفدت التذاكر" : `${occupancy.remaining} متبقي`}
            </span>
            <span className="font-mono text-zinc-500">{occupancy.pct}% إشغال</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className={cn("h-full rounded-full transition-all", occupancy.barClass)} style={{ width: `${occupancy.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Ticket className="h-3.5 w-3.5 text-amber-400" />
            فئات التذاكر
          </p>
          <div className="space-y-2">
            {tiers.map((tier, index) => (
              <TierOption
                key={tier.id}
                tier={tier}
                index={index}
                active={tier.id === selected?.id}
                remaining={Math.max(0, Math.round(occupancy.remaining / Math.max(1, tiers.length)))}
                onSelect={() => {
                  setSelectedId(tier.id)
                  setQuantity(1)
                  setNotice(null)
                }}
              />
            ))}
          </div>
        </div>

        {selected && !soldOut && (
          <QuantityRow
            quantity={quantity}
            maxQuantity={Math.min(8, Math.max(1, occupancy.remaining))}
            unitCents={unitCents}
            totalCents={deal.totalCents}
            discountPct={deal.pct}
            savingsCents={deal.savingsCents}
            onChange={setQuantity}
          />
        )}

        {canBook ? (
          <Link
            href={bookHref}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <ShoppingBag className="h-4 w-4" />
            احجز دلوقتي
          </Link>
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-center text-xs text-zinc-400">
            {soldOut ? "نفدت تذاكر هذا العرض — سجّل في قائمة الانتظار." : blockedReason ?? "الحجز غير متاح حاليًا."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setNotice(`سيتم إرسال رابط هدية لعرض «${title}» إلى البريد الذي تختاره.`)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <Gift className="h-3.5 w-3.5" />
            هدية 🎁
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/shows/${slug}`
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title, url }).catch(() => undefined)
                return
              }
              void navigator.clipboard.writeText(url).catch(() => undefined)
              setNotice("تم نسخ رابط العرض 🔗")
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <Share2 className="h-3.5 w-3.5" />
            مشاركة 🔗
          </button>
        </div>

        {notice && (
          <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
