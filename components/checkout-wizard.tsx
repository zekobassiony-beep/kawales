"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateTotals } from "@/lib/pricing"
import { formatDate, formatPrice, tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, parseSeatId } from "@/lib/seats"
import type { EventWithRelations } from "@/lib/queries"
import { createTicket, applyAutomationUpdate, setTicketStatus, startTicketStatusPolling, useTicket, DEFAULT_PAYMENT_METHOD_ID, type PaymentMethod, type Ticket } from "@/lib/tickets"
import { usePaymentMethods } from "@/lib/payment-methods"
import { useSession } from "@/lib/session"
import { sendReceiptVerification } from "@/app/actions/telegram"
import { GeneralAdmissionTiers, NumberedSeats, PaymentStep, TicketConfirmation } from "@/components/checkout-steps"
import { findProductionByTitle, productionSeatTiers, useWorkspace, type SeatPriceTier } from "@/lib/productions"

/**
 * مكون الحجز والدفع المباشر من ثلاث خطوات:
 *  1) اختيار المقاعد أو الفئات — حسب نمط الحجز للعرض.
 *  2) اختيار وسيلة الدفع المباشرة.
 *  3) تأكيد الطلب واستلام التذكرة.
 */

type Mode = "numbered" | "general"

function StepPill({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/10"
          : done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-border/60 text-muted-foreground",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary/70 text-[10px] font-bold">
        {done ? <CheckCircle2 className="h-3 w-3" /> : index}
      </span>
      {label}
    </span>
  )
}

export function CheckoutWizard({ event, mode }: { event: EventWithRelations; mode: Mode }) {
  const session = useSession()
  const workspace = useWorkspace()
  const paymentMethods = usePaymentMethods().filter((item) => item.isActive)

  /**
   * فئات المقاعد الفعّالة: تُؤخذ من الفئات المخصّصة التي عرّفها المخرج/الفرقة في
   * نموذج إنشاء العرض (محفوظة مع العرض في مساحة العمل) — لكل عرض بشكل مستقل —
   * وإن لم توجد فئات مخصّصة نرجع لفئات قاعدة البيانات.
   */
  const tiers = useMemo<SeatPriceTier[]>(() => {
    const match = findProductionByTitle(workspace.productions, event.title)
    const custom = match ? productionSeatTiers(match.tiers) : []
    return custom.length > 0 ? custom : event.priceTiers
  }, [workspace.productions, event.title, event.priceTiers])

  const effectiveEvent = useMemo<EventWithRelations>(() => ({ ...event, priceTiers: tiers }), [event, tiers])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [seatIds, setSeatIds] = useState<string[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<PaymentMethod>(paymentMethods[0]?.id ?? DEFAULT_PAYMENT_METHOD_ID)
  const [senderPhone, setSenderPhone] = useState("")
  const [receiptImage, setReceiptImage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)

  const toggleSeat = (seatId: string) => {
    setError(null)
    if (seatIds.includes(seatId)) {
      setSeatIds(seatIds.filter((id) => id !== seatId))
      return
    }
    if (seatIds.length >= MAX_SEATS_PER_BOOKING) {
      setError(`يمكنك اختيار حتى ${MAX_SEATS_PER_BOOKING} مقاعد لكل حجز.`)
      return
    }
    setSeatIds([...seatIds, seatId])
  }

  const items = useMemo(() => {
    if (mode === "numbered") {
      return seatIds.map((seatId) => {
        const parsed = parseSeatId(seatId)
        const tier = parsed ? tierForRow(tiers, parsed.rowIndex) : undefined
        return { label: seatId, priceCents: tier?.priceCents ?? 0, tierName: tier?.name ?? "—" }
      })
    }
    return tiers.flatMap((tier) =>
      Array.from({ length: quantities[tier.id] ?? 0 }, () => ({
        label: tier.name,
        priceCents: tier.priceCents,
        tierName: tier.name,
      })),
    )
  }, [tiers, mode, quantities, seatIds])

  const totals = useMemo(() => calculateTotals(items.map((item) => item.priceCents)), [items])

  const tierName = useMemo(() => {
    const names = [...new Set(items.map((item) => item.tierName))]
    return names.length > 0 ? names.join(" + ") : "—"
  }, [items])

  const seats = useMemo(
    () => (mode === "numbered" ? [...seatIds].sort() : items.map((item) => item.label)),
    [items, mode, seatIds],
  )

  /* متابعة حيّة لحالة التذكرة: تتحدث تلقائيًا فور قرار الإدارة. */
  const liveTicket = useTicket(ticket?.id ?? "")
  useEffect(() => {
    if (!ticket) return
    return startTicketStatusPolling(4000)
  }, [ticket])

  /* استطلاع قرار الإدارة من سجل الخادم (الذي يحدّثه ويب هوك التليجرام). */
  useEffect(() => {
    if (!ticket) return
    let cancelled = false
    const check = async () => {
      try {
        const response = await fetch(`/api/tickets/status?id=${encodeURIComponent(ticket.id)}`)
        const data = (await response.json()) as { status?: string }
        if (cancelled) return
        if (data.status === "approved" || data.status === "rejected") {
          setTicketStatus(ticket.id, data.status)
        }
      } catch {
        // تجاهل فشل الشبكة — سيُعاد الاستطلاع.
      }
    }
    const timer = window.setInterval(check, 3000)
    void check()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ticket])


  if (ticket) {
    return (
      <div className="mx-auto max-w-2xl">
        <TicketConfirmation
          ticket={liveTicket ?? ticket}
          onSimulateApproval={() => applyAutomationUpdate({ reference: ticket.id, status: "approved" })}
          onSimulateRejection={() => applyAutomationUpdate({ reference: ticket.id, status: "rejected" })}
        />
        <Link
          href="/dashboard/customer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          عرض تذكرتي في لوحة العميل
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StepPill index={1} label="المقاعد / الفئات" active={step === 1} done={step > 1} />
        <StepPill index={2} label="الدفع المباشر" active={step === 2} done={step > 2} />
        <StepPill index={3} label="مراجعة الإيصال" active={step === 3} done={false} />
      </div>
      <p className="text-xs text-muted-foreground">
        {event.title} · {event.venue.name} · {formatDate(event.startsAt)} · نمط الحجز:{" "}
        {mode === "numbered" ? "كراسي محددة" : "فئات مفتوحة"}
      </p>

      {step === 1 && (
        <div className="space-y-4">
          {mode === "numbered" ? (
            <NumberedSeats event={effectiveEvent} selected={seatIds} onToggle={toggleSeat} />
          ) : (
            <GeneralAdmissionTiers
              event={effectiveEvent}
              quantities={quantities}
              onSet={(tierId, quantity) => {
                setError(null)
                setQuantities((current) => ({ ...current, [tierId]: quantity }))
              }}
            />
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              المختار: <span className="font-bold">{items.length}</span> · الإجمالي:{" "}
              <span className="font-serif font-bold">{formatPrice(totals.totalCents)}</span>{" "}
              <span className="text-xs text-muted-foreground">(شامل رسوم الخدمة)</span>
            </p>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                setError(null)
                setStep(2)
              }}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              متابعة إلى الدفع
            </button>
          </div>
        </div>
      )}


      {step === 2 && (
        <div className="space-y-4">
          <PaymentStep
            totalCents={totals.totalCents}
            method={method}
            onChange={setMethod}
            senderPhone={senderPhone}
            onSenderPhoneChange={setSenderPhone}
            receiptImage={receiptImage}
            onReceiptChange={setReceiptImage}
          />
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-border/60 px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={() => {
                if (senderPhone.trim().length < 8) {
                  setError("أدخل رقم الموبايل الذي تم التحويل منه.")
                  return
                }
                if (!receiptImage) {
                  setError("أرفق صورة إيصال التحويل / Screenshot.")
                  return
                }
                setError(null)
                const created = createTicket({
                  showId: String(event.id),
                  showTitle: event.title,
                  posterUrl: event.posterUrl ?? undefined,
                  venue: `${event.venue.name}، ${event.venue.city}`,
                  startsAt: new Date(event.startsAt).toLocaleString("ar-EG"),
                  customerId: session?.email ?? "",
                  customerName: session?.profile.fullName || session?.name || "ضيف كواليس",
                  seats,
                  tierName,
                  startsAtIso: event.startsAt.toISOString(),
                  totalCents: totals.totalCents,
                  paymentMethod: method,
                  // مرجع التحويل الوحيد المطلوب من العميل هو رقم المحوّل نفسه.
                  paymentRef: senderPhone,
                  senderPhone,
                  receiptImage,
                })
                setTicket(created)
                setStep(3)
                // إرسال الإيصال للإدارة عبر التليجرام مع أزرار قبول/رفض (fire-and-forget).
                void sendReceiptVerification({
                  ticketId: created.id,
                  qrPayload: created.qrCode,
                  showTitle: created.showTitle,
                  venue: created.venue,
                  seatsCount: created.seats.length,
                  seatsLabel: created.seats.join("، "),
                  totalCents: created.totalCents,
                  senderPhone: created.senderPhone ?? "",
                  receiptImage: created.receiptImage,
                  paymentMethod: created.paymentMethod,
                }).catch(() => undefined)
              }}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              إتمام الحجز وإرسال الإيصال للمراجعة
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
