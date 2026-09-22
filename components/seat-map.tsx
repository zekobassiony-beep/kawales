"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Info, Loader2, Ticket } from "lucide-react"
import { createBooking } from "@/app/actions/booking"
import { formatPrice, rowLabel, tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, hexToRgba, makeSeatId, parseSeatId } from "@/lib/seats"
import { calculateTotals } from "@/lib/pricing"
import { PaymentWalletCard } from "@/components/payment-wallet-card"
import { cn } from "@/lib/utils"
import type { EventWithRelations } from "@/lib/queries"

export function SeatMap({
  event,
  bookedSeatIds,
  databaseReady,
}: {
  event: EventWithRelations
  bookedSeatIds: string[]
  databaseReady: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [taken, setTaken] = useState<string[]>(bookedSeatIds)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [receipt, setReceipt] = useState<{
    filename: string
    mimeType: string
    dataBase64: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const takenSet = useMemo(() => new Set(taken), [taken])
  const rows = useMemo(
    () => Array.from({ length: event.venue.rows }, (_, index) => index),
    [event.venue.rows],
  )
  const selectedSeats = useMemo(
    () =>
      selected.map((seatId) => {
        const parsed = parseSeatId(seatId)
        const tier = parsed ? tierForRow(event.priceTiers, parsed.rowIndex) : undefined
        return { seatId, tier }
      }),
    [selected, event.priceTiers],
  )
  const totals = useMemo(
    () => calculateTotals(selectedSeats.map((seat) => seat.tier?.priceCents ?? 0)),
    [selectedSeats],
  )
  const canSubmit = !pending && databaseReady && selected.length > 0

  function toggleSeat(seatId: string) {
    if (takenSet.has(seatId) || pending) return
    setError(null)
    if (selected.includes(seatId)) {
      setSelected(selected.filter((current) => current !== seatId))
      return
    }
    if (selected.length >= MAX_SEATS_PER_BOOKING) {
      setError(`يمكنك اختيار حتى ${MAX_SEATS_PER_BOOKING} مقاعد لكل حجز.`)
      return
    }
    setSelected([...selected, seatId])
  }

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    if (selected.length === 0) {
      setError("من فضلك اختر مقعدًا واحدًا على الأقل.")
      return
    }
    if (!phone.trim()) {
      setError("من فضلك أدخل رقم هاتفك.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await createBooking({
          eventId: event.id,
          seatIds: selected,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          receipt: receipt ?? undefined,
        })

        if (result.ok) {
          router.push(`/bookings/${result.reference}`)
          return
        }

        setError(result.error)
        const takenSeats = result.takenSeats
        if (takenSeats && takenSeats.length > 0) {
          setTaken((current) => Array.from(new Set([...current, ...takenSeats])))
          setSelected((current) => current.filter((seatId) => !takenSeats.includes(seatId)))
        }
      } catch (unexpected) {
        setError(
          unexpected instanceof Error
            ? `تعذّر إتمام حجزك: ${unexpected.message}`
            : "تعذّر إتمام حجزك. من فضلك حاول مرة أخرى.",
        )
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
          <div className="mx-auto mb-8 max-w-md">
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <p className="mt-2 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
              المسرح
            </p>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="mx-auto w-max space-y-1.5">
              {rows.map((rowIndex) => {
                const tier = tierForRow(event.priceTiers, rowIndex)
                return (
                  <div key={rowIndex} className="flex items-center justify-center gap-2">
                    <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      {rowLabel(rowIndex)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {Array.from(
                        { length: event.venue.seatsPerRow },
                        (_, seatIndex) => seatIndex + 1,
                      ).map((seatNumber) => {
                        const seatId = makeSeatId(rowIndex, seatNumber)
                        const isTaken = takenSet.has(seatId)
                        const isSelected = selected.includes(seatId)
                        return (
                          <button
                            key={seatId}
                            type="button"
                            onClick={() => toggleSeat(seatId)}
                            disabled={isTaken || pending}
                            aria-pressed={isSelected}
                            aria-label={`المقعد ${seatId}${tier ? `، ${tier.name}، ${formatPrice(tier.priceCents)}` : ""}${isTaken ? "، محجوز" : ""}`}
                            title={`${seatId}${tier ? ` · ${tier.name} · ${formatPrice(tier.priceCents)}` : ""}`}
                            style={
                              isTaken || isSelected || !tier
                                ? undefined
                                : {
                                    backgroundColor: hexToRgba(tier.color, 0.16),
                                    borderColor: hexToRgba(tier.color, 0.45),
                                  }
                            }
                            className={cn(
                              "h-7 w-7 shrink-0 rounded-md border text-[10px] font-semibold leading-none transition-all",
                              isTaken &&
                                "cursor-not-allowed border-border/40 bg-secondary/40 text-muted-foreground/40",
                              isSelected && "border-primary bg-primary text-primary-foreground",
                              !isTaken &&
                                !isSelected &&
                                "hover:scale-110 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            )}
                          >
                            {seatNumber}
                          </button>
                        )
                      })}
                    </div>
                    <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      {rowLabel(rowIndex)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border/60 pt-5 text-xs text-muted-foreground">
            {event.priceTiers.map((tier) => (
              <span key={tier.id} className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded border"
                  style={{
                    backgroundColor: hexToRgba(tier.color, 0.16),
                    borderColor: hexToRgba(tier.color, 0.45),
                  }}
                />
                {tier.name} · {formatPrice(tier.priceCents)}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded border border-border/40 bg-secondary/40" />
              محجوز
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded bg-primary" />
              اختيارك
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          اضغط على أي مقعد لتحديده أو إلغائه · حتى {MAX_SEATS_PER_BOOKING} مقاعد لكل حجز
        </p>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-xl border border-border/60 bg-card"
        >
          <div className="border-b border-border/60 p-5">
            <h2 className="font-serif text-lg font-semibold">مقاعدك</h2>
            {selectedSeats.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                لم تختر أي مقعد بعد. اختر مكانك من الخريطة.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedSeats.map(({ seatId, tier }) => (
                  <li key={seatId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      {tier && (
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tier.color }}
                        />
                      )}
                      <span className="font-medium">{seatId}</span>
                      <span className="text-muted-foreground">{tier?.name ?? "بلا سعر"}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatPrice(tier?.priceCents ?? 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSeat(seatId)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`إزالة المقعد ${seatId}`}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-b border-border/60 p-5 text-sm">
            <SummaryRow label="المجموع الفرعي" value={formatPrice(totals.subtotalCents)} />
            <SummaryRow label="رسوم الخدمة" value={formatPrice(totals.serviceFeeCents)} />
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="font-medium">الإجمالي</span>
              <span className="text-lg font-semibold">{formatPrice(totals.totalCents)}</span>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <PaymentWalletCard totalLabel={formatPrice(totals.totalCents)} />
            <Field
              id="customer-name"
              label="الاسم بالكامل"
              value={name}
              onChange={setName}
              placeholder="نور حسن"
              autoComplete="name"
            />
            <Field
              id="customer-email"
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="nour@example.com"
              autoComplete="email"
            />
            <Field
              id="customer-phone"
              label="رقم الهاتف"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="+20 100 000 0000"
              autoComplete="tel"
            />

            <div>
              <label htmlFor="payment-receipt" className="block text-xs text-muted-foreground">
                إيصال التحويل (فودافون كاش)
              </label>
              <input
                id="payment-receipt"
                name="payment-receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={(fileEvent) => {
                  const file = fileEvent.target.files?.[0] ?? null
                  if (!file) {
                    setReceipt(null)
                    return
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setError("حجم الإيصال أكبر من 5 ميجابايت. من فضلك أرفق صورة أصغر.")
                    fileEvent.target.value = ""
                    return
                  }
                  setError(null)
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = String(reader.result ?? "")
                    const commaIndex = dataUrl.indexOf(",")
                    if (dataUrl.startsWith("data:") && commaIndex > 0) {
                      const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "application/octet-stream"
                      setReceipt({
                        filename: file.name,
                        mimeType,
                        dataBase64: dataUrl.slice(commaIndex + 1),
                      })
                    } else {
                      setReceipt(null)
                      setError("تعذّر قراءة الملف. من فضلك جرّب صورة أخرى.")
                    }
                  }
                  reader.readAsDataURL(file)
                }}
                className="mt-1 w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none transition-colors file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {receipt
                  ? `تم إرفاق: ${receipt.filename}`
                  : "ارفع لقطة شاشة لتأكيد تحويل فودافون كاش (حتى 5 ميجابايت)."}
              </p>
            </div>

            {!databaseReady && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                الحجز الفعلي متوقف لأنه لا توجد قاعدة بيانات مهيأة. خريطة المقاعد للتوضيح فقط.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الحجز…
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4" />
                  تأكيد الحجز
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              دفع آمن · تذكرة رقمية فورية
            </p>
          </div>
        </form>
      </aside>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(inputEvent) => onChange(inputEvent.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  )
}