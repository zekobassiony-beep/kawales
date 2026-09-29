"use client"

import { useMemo, useState } from "react"
import { Armchair, ShoppingBag, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPriceLabel, tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, parseSeatId } from "@/lib/seats"
import { calculateTotals } from "@/lib/pricing"
import { couponPriceShape } from "@/lib/coupon-pricing"
import { groupDiscount, lowestPriceCents, occupancyInfo } from "@/lib/show-detail"
import type { Coupon } from "@/lib/coupons"
import type { EventWithRelations } from "@/lib/queries"
import { CouponBox } from "@/components/coupon-box"
import { CouponAppliedNote, CouponPrice, CouponTotals } from "@/components/coupon-price"
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
  const [pay, setPay] = useState<PaymentSelection | null>(null)

  const selectedTier = tiers.find((tier) => tier.id === selectedId) ?? tiers[0]
  const unitCents = selectedTier?.priceCents ?? 0
  const deal = useMemo(() => groupDiscount(quantity, unitCents), [quantity, unitCents])
  const minPrice = lowestPriceCents(tiers)
  const soldOut = occupancy.remaining === 0
  const blocked = Boolean(blockedReason)

  /** كوبون الزائر المطبَّق على الأسعار (اختياري). */
  const [coupon, setCoupon] = useState<Coupon | null>(null)

  /**
   * أسعار التذاكر الحالية **قبل** الكوبون:
   * - المقاعد التفاعلية: سعر فئة كل مقعد مختار.
   * - الفئات العامة: سعر الفئة × الكمية بعد خصم الشلة (ثم يُطبَّق الكوبون فوقه).
   */
  const seatPrices = useMemo(() => {
    if (interactive) {
      return selectedSeats.map((seatId) => {
        const parsed = parseSeatId(seatId)
        return parsed ? (tierForRow(tiers, parsed.rowIndex)?.priceCents ?? 0) : 0
      })
    }
    return deal.totalCents > 0 ? [deal.totalCents] : []
  }, [interactive, selectedSeats, tiers, deal.totalCents])

  /** شكل السعر بعد الكوبون — مصدر الحقيقة لكل ما يُعرض ولمبلغ الدفع. */
  const priceShape = useMemo(() => couponPriceShape(seatPrices, coupon), [seatPrices, coupon])
  const minPriceShape = useMemo(() => couponPriceShape([minPrice], coupon), [minPrice, coupon])

  const selection = useMemo<PaymentSelection | null>(() => {
    if (seatPrices.length === 0) return null

    const names = interactive
      ? [
          ...new Set(
            seatPrices.map((_, index) => {
              const parsed = parseSeatId(selectedSeats[index] ?? "")
              return parsed ? (tierForRow(tiers, parsed.rowIndex)?.name ?? "—") : "—"
            }),
          ),
        ]
      : [selectedTier?.name ?? "—"]

    return {
      seats: interactive ? [...selectedSeats].sort() : [`${quantity} × ${selectedTier?.name ?? "—"}`],
      tierName: names.join(" + ") || "—",
      totalCents: priceShape.totalCents,
      quantity: seatPrices.length,
      /** شكل السعر بعد الكوبون: يُعرض في نافذة الدفع ويُخزَّن مع التذكرة. */
      priceShape: coupon && priceShape.hasDiscount ? priceShape : undefined,
    }
  }, [
    interactive,
    selectedSeats,
    selectedTier,
    seatPrices,
    tiers,
    quantity,
    coupon,
    priceShape,
  ])

  const toggleSeat = (seatId: string) => {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((id) => id !== seatId))
      return
    }
    // الحد الأقصى للمقاعد في الطلب الواحد (تظهر التلميحة أسفل خريطة الكراسي).
    if (selectedSeats.length >= MAX_SEATS_PER_BOOKING) return
    setSelectedSeats([...selectedSeats, seatId])
  }

  const canProceed = !blocked && !soldOut && tiers.length > 0 && selection !== null

  return (
    <div className={cn(SIDEBAR_CARD, "overflow-hidden")}>
      <div className="border-b border-zinc-800 bg-gradient-to-l from-amber-500/10 via-transparent to-transparent p-5">
        <p className="text-xs text-zinc-400">يبدأ من</p>
        {coupon && minPriceShape.hasDiscount ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <CouponPrice shape={minPriceShape} size="xl" />
            <span className="text-sm font-normal text-zinc-500">/ تذكرة</span>
          </p>
        ) : (
          <p className="mt-1 font-serif text-3xl font-bold text-amber-400">
            {formatPriceLabel(minPrice)}
            <span className="ms-1 text-sm font-normal text-zinc-500">/ تذكرة</span>
          </p>
        )}

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
            <NumberedSeats
              event={event}
              selected={selectedSeats}
              onToggle={toggleSeat}
              bookedSeatIds={bookedSeatIds}
              coupon={coupon}
            />
            {selection ? (
              <p className="text-sm text-zinc-300">
                المختار: <span className="font-bold text-zinc-100">{selection.quantity}</span> · الإجمالي:{" "}
                <span
                  className={cn(
                    "font-serif font-bold",
                    priceShape.isFree ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {formatPriceLabel(priceShape.totalCents)}
                </span>{" "}
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
                    priceShape={coupon ? couponPriceShape([tier.priceCents], coupon) : undefined}
                    onSelect={() => {
                      setSelectedId(tier.id)
                      setQuantity(1)
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
                totalCents={coupon ? priceShape.discountedSubtotalCents : deal.totalCents}
                discountPct={deal.pct}
                savingsCents={deal.savingsCents}
                onChange={setQuantity}
              />
            )}
          </>
        )}

        {/* كوبون الخصم (اختياري): يُطبَّق لحظيًا على السعر ورسوم الخدمة معًا */}
        {!soldOut && !blocked && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
            <CouponBox
              context={{ eventId: event.id, troupeId: event.troupe.id, venueId: event.venue.id }}
              applied={coupon}
              onApply={setCoupon}
              onClear={() => setCoupon(null)}
            />
            {coupon && <CouponAppliedNote shape={priceShape} />}
            {coupon && selection && <CouponTotals shape={priceShape} />}
          </div>
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
            {soldOut ? "نفدت تذاكر هذا العرض." : blockedReason ?? "الحجز غير متاح حاليًا."}
          </p>
        )}

      </div>

      {pay && <PaymentModal event={event} selection={pay} open onClose={() => setPay(null)} />}
    </div>
  )
}
