"use client"

import { useMemo, useState } from "react"
import { Armchair, Gift, Share2, ShoppingBag, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, parseSeatId } from "@/lib/seats"
import { calculateTotals } from "@/lib/pricing"
import { groupDiscount, occupancyInfo } from "@/lib/show-detail"
import type { EventWithRelations } from "@/lib/queries"
import { QuantityRow, SIDEBAR_CARD, TierOption } from "@/app/shows/[slug]/show-booking-parts"
import { NumberedSeats } from "@/components/checkout-steps"
import { PaymentModal, type PaymentSelection } from "@/components/payment-modal"

/**
 * صندوق الحجز الموحّد على صفحة العرض — يتكيف مع نوع العرض:
 * - مقاعد تفاعلية (has_interactive_seats = true): خريطة كراسي تفاعلية ثم زر
 *   «متابعة إلى الدفع» يفتح نافذة الدفع الموحّدة.
 * - فئات عامة (false): كارت الفئة + العداد ثم زر «احجز دلوقتي» يفتح نافذة
 *   الدفع الموحّدة مباشرة دون خريطة كراسي.
 */
export function ShowBookingBox({
  event,
  capacity,
  sold,
  bookedSeatIds,
  blockedReason,
}: {
  event: EventWithRelations
  capacity: number
  sold: number
  bookedSeatIds: string[]
  blockedReason: string | null
}) {
  const tiers = event.priceTiers
  const interactive = event.hasInteractiveSeats

  const occupancy = useMemo(() => occupancyInfo(sold, capacity), [sold, capacity])
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState(tiers[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [pay, setPay] = useState<PaymentSelection | null>(null)

  const selectedTier = tiers.find((tier) => tier.id === selectedId) ?? tiers[0]
  const unitCents = selectedTier?.priceCents ?? 0
  const deal = useMemo(() => groupDiscount(quantity, unitCents), [quantity, unitCents])
  const minPrice = Math.min(...tiers.map((tier) => tier.priceCents), 0)
  const soldOut = occupancy.remaining === 0
  const blocked = Boolean(blockedReason)

  const selection = useMemo<PaymentSelection | null>(() => {
    if (interactive) {
      if (selectedSeats.length === 0) return null
      const items = selectedSeats.map((seatId) => {
        const parsed = parseSeatId(seatId)
        const tier = parsed ? tierForRow(tiers, parsed.rowIndex) : undefined
        return { priceCents: tier?.priceCents ?? 0, tierName: tier?.name ?? "—" }
      })
      const totals = calculateTotals(items.map((item) => item.priceCents))
      const names = [...new Set(items.map((item) => item.tierName))]
      return {
        seats: [...selectedSeats].sort(),
        tierName: names.join(" + ") || "—",
        totalCents: totals.totalCents,
        quantity: items.length,
      }
    }
    if (!selectedTier) return null
    const totals = calculateTotals(Array.from({ length: quantity }, () => selectedTier.priceCents))
    return {
      seats: [`${quantity} × ${selectedTier.name}`],
      tierName: selectedTier.name,
      totalCents: totals.totalCents,
      quantity,
    }
  }, [interactive, selectedSeats, tiers, selectedTier, quantity])

  const toggleSeat = (seatId: string) => {
    setNotice(null)
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((id) => id !== seatId))
      return
    }
    if (selectedSeats.length >= MAX_SEATS_PER_BOOKING) {
      setNotice(`يمكنك اختيار حتى ${MAX_SEATS_PER_BOOKING} مقاعد لكل حجز.`)
      return
    }
    setSelectedSeats([...selectedSeats, seatId])
  }

  const canProceed = !blocked && !soldOut && tiers.length > 0 && selection !== null

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
        {interactive ? (
          <>
            <NumberedSeats event={event} selected={selectedSeats} onToggle={toggleSeat} bookedSeatIds={bookedSeatIds} />
            {selection ? (
              <p className="text-sm text-zinc-300">
                المختار: <span className="font-bold text-zinc-100">{selection.quantity}</span> · الإجمالي:{" "}
                <span className="font-serif font-bold text-amber-400">{formatPrice(selection.totalCents)}</span>{" "}
                <span className="text-xs text-zinc-500">(شامل رسوم الخدمة)</span>
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Armchair className="h-3.5 w-3.5 text-amber-400" />
                اختر مقاعدك من الخريطة للمتابعة.
              </p>
            )}
          </>
        ) : (
          <>
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
                    active={tier.id === selectedTier?.id}
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

            {selectedTier && !soldOut && (
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
          </>
        )}

        {canProceed ? (
          <button
            type="button"
            onClick={() => selection && setPay(selection)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <ShoppingBag className="h-4 w-4" />
            {interactive ? "متابعة إلى الدفع" : "احجز دلوقتي"}
          </button>
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-center text-xs text-zinc-400">
            {soldOut ? "نفدت تذاكر هذا العرض — سجّل في قائمة الانتظار." : blockedReason ?? "الحجز غير متاح حاليًا."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setNotice(`سيتم إرسال رابط هدية لعرض «${event.title}» إلى البريد الذي تختاره.`)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <Gift className="h-3.5 w-3.5" />
            هدية 🎁
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/shows/${event.slug}`
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({ title: event.title, url }).catch(() => undefined)
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

      {pay && <PaymentModal event={event} selection={pay} open onClose={() => setPay(null)} />}
    </div>
  )
}
