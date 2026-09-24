"use client"

import { useEffect, useState } from "react"
import { Loader2, Receipt, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import type { EventWithRelations } from "@/lib/queries"
import { createTicket, DEFAULT_PAYMENT_METHOD_ID, type PaymentMethod, type Ticket } from "@/lib/tickets"
import { persistTicket } from "@/app/actions/tickets"
import { sendReceiptVerification } from "@/app/actions/telegram"
import { usePaymentMethods } from "@/lib/payment-methods"
import { useSession } from "@/lib/session"
import { PaymentStep, TicketConfirmation } from "@/components/checkout-steps"

/**
 * نافذة الدفع الموحّدة (Unified Payment Modal) — المصدر الوحيد لإتمام الدفع في
 * المشروع: اختيار وسيلة الدفع، إدخال رقم المحوّل، إرفاق صورة الإيصال، ثم
 * إنشاء التذكرة وحفظها في Supabase وإرسالها للإدارة على تليجرام.
 */

export type PaymentSelection = {
  /** تسميات المقاعد/الفئات المختارة (A1، A2… أو «2 × أوركسترا»). */
  seats: string[]
  tierName: string
  totalCents: number
  quantity: number
}

export function PaymentModal({
  event,
  selection,
  open,
  onClose,
}: {
  event: EventWithRelations
  selection: PaymentSelection
  open: boolean
  onClose: () => void
}) {
  const session = useSession()
  const methods = usePaymentMethods().filter((item) => item.isActive)
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.id ?? DEFAULT_PAYMENT_METHOD_ID)
  const [senderPhone, setSenderPhone] = useState("")
  const [receiptImage, setReceiptImage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)

  /* إعادة تهيئة الحالة عند كل فتح للنافذة. */
  useEffect(() => {
    if (!open) return
    setMethod(methods[0]?.id ?? DEFAULT_PAYMENT_METHOD_ID)
    setSenderPhone("")
    setReceiptImage("")
    setError(null)
    setBusy(false)
    setTicket(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* الإغلاق بمفتاح Escape. */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const customerName = session?.profile.fullName || session?.name || "ضيف كواليس"
  const customerEmail = session?.email ?? ""
  const seatsLabel = selection.seats.join("، ")

  async function confirm() {
    if (senderPhone.trim().length < 8) {
      setError("أدخل رقم الموبايل الذي تم التحويل منه.")
      return
    }
    if (!receiptImage) {
      setError("أرفق صورة إيصال التحويل / Screenshot.")
      return
    }
    setError(null)
    setBusy(true)

    const created = createTicket({
      showId: String(event.id),
      showTitle: event.title,
      posterUrl: event.posterUrl ?? undefined,
      venue: `${event.venue.name}، ${event.venue.city}`,
      startsAt: new Date(event.startsAt).toLocaleString("ar-EG"),
      customerId: customerEmail,
      customerName,
      seats: selection.seats,
      tierName: selection.tierName,
      startsAtIso: event.startsAt.toISOString(),
      totalCents: selection.totalCents,
      paymentMethod: method,
      paymentRef: senderPhone,
      senderPhone,
      receiptImage,
    })

    setTicket(created)
    setBusy(false)

    // حفظ التذكرة في Supabase (يرفع الإيصال إلى Storage ويحفظ publicUrl في receipt_url).
    void persistTicket(created).catch(() => undefined)
    // إرسال الإيصال للإدارة على تليجرام مع أزرار قبول/رفض (fire-and-forget).
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
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إتمام الدفع وإرفاق الإيصال"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="my-8 w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/30 bg-zinc-900 shadow-[0_0_60px_-20px_rgba(245,158,11,0.8)]">
        {/* شريط علوي */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-gradient-to-l from-amber-500/10 via-transparent to-transparent px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400">
              <Receipt className="h-3.5 w-3.5" />
              إتمام الدفع
            </p>
            <h3 className="mt-1 truncate font-serif text-lg font-bold text-zinc-50">{event.title}</h3>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {ticket ? (
          <div className="space-y-4 p-5">
            <TicketConfirmation ticket={ticket} onSimulateApproval={() => undefined} />
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
            >
              تم — العودة للعرض
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {/* ملخص الطلب */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{seatsLabel || selection.tierName}</p>
                <p className="text-[11px] text-zinc-500">
                  {selection.quantity} تذكرة · {selection.tierName}
                </p>
              </div>
              <p className="font-serif text-xl font-bold text-amber-400">{formatPrice(selection.totalCents)}</p>
            </div>

            <PaymentStep
              totalCents={selection.totalCents}
              method={method}
              onChange={setMethod}
              senderPhone={senderPhone}
              onSenderPhoneChange={setSenderPhone}
              receiptImage={receiptImage}
              onReceiptChange={setReceiptImage}
            />

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 transition-colors",
                busy ? "cursor-wait opacity-70" : "hover:bg-amber-400",
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الحفظ…
                </>
              ) : (
                "إتمام الحجز وإرسال الإيصال للمراجعة"
              )}
            </button>
            <p className="text-center text-[11px] text-zinc-500">
              سيُفعَّل رمز QR تلقائيًا فور موافقة الإدارة على الإيصال.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
