"use client"

import { useEffect, useState } from "react"
import { Loader2, Receipt, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import type { EventWithRelations } from "@/lib/queries"
import { createTicket, DEFAULT_PAYMENT_METHOD_ID, setTicketReceiptUrl, telegramTicketLink, type PaymentMethod, type Ticket } from "@/lib/tickets"
import { notifyTicketAdmin, persistTicket, type PersistTicketResult } from "@/app/actions/tickets"
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
  const [outcome, setOutcome] = useState<PersistTicketResult | null>(null)
  /** حالة إعادة إرسال إشعار الإدارة (زر الاحتياط عند تعطّل تليجرام). */
  const [resending, setResending] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

  /* إعادة تهيئة الحالة عند كل فتح للنافذة. */
  useEffect(() => {
    if (!open) return
    setMethod(methods[0]?.id ?? DEFAULT_PAYMENT_METHOD_ID)
    setSenderPhone("")
    setReceiptImage("")
    setError(null)
    setBusy(false)
    setTicket(null)
    setOutcome(null)
    setResending(false)
    setResendNotice(null)
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

    // الـ Trigger الموحّد: يحفظ التذكرة + يرفع الإيصال إلى Storage، ثم **يجدول** إشعار
    // الإدارة على تليجرام في الخلفية — فيعود الرد سريعًا بلا انتظار نداءات تليجرام.
    const result = await persistTicket(created)

    // استبدال Base64 الثقيل في التخزين المحلي بالرابط العام (أخف بكثير وأسرع في القراءة).
    if (result.receiptUrl) setTicketReceiptUrl(created.id, result.receiptUrl)

    setOutcome(result)
    setBusy(false)
    if (!result.ok) {
      console.error(`[checkout] تعذّر حفظ التذكرة ${created.id}: ${result.error ?? "سبب غير معروف"}`)
    }
  }

  /** إعادة إرسال إشعار الإدارة لتذكرة محفوظة (لو كان تليجرام متعطّلًا لحظة الحجز). */
  async function resendAdminNotification() {
    if (!ticket) return
    setResending(true)
    setResendNotice(null)
    const result = await notifyTicketAdmin(ticket.id)
    setResending(false)
    setResendNotice(
      result.ok
        ? "أعدنا إرسال الطلب إلى الإدارة على تليجرام ✓ — راجع البوت الآن."
        : result.error ?? "تعذّر إعادة الإرسال — حاول مرة أخرى.",
    )
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

            {/* حالة حفظ الطلب وإشعار الإدارة (الإشعار يُنفَّذ في الخلفية بلا حجب الواجهة). */}
            {outcome?.notifyState === "queued" ? (
              <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-[11px] leading-relaxed text-emerald-200">
                تم حفظ طلبك ✓ — جارٍ إرسال التفاصيل إلى الإدارة على تليجرام. تتحدّث حالة التذكرة
                هنا تلقائيًا لحظة اعتماد الإيصال.
              </p>
            ) : (
              <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-[11px] leading-relaxed text-red-200">
                تعذّر حفظ طلب التذكرة{outcome?.error ? `: ${outcome.error}` : "."} — أعد المحاولة أو تواصل مع الدعم.
              </p>
            )}

            {/* إعادة إرسال الإشعار للإدارة عند الحاجة (تليجرام بطيء/غير متاح لحظة الحجز). */}
            {outcome?.notifyState === "queued" && !resendNotice && (
              <button
                type="button"
                onClick={() => void resendAdminNotification()}
                disabled={resending}
                className="w-full rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:opacity-60"
              >
                {resending ? "جارٍ إعادة الإرسال…" : "لم يظهر الطلب في البوت؟ أعد إرساله للإدارة"}
              </button>
            )}
            {resendNotice && (
              <p role="status" className="text-[11px] leading-relaxed text-sky-200">
                {resendNotice}
              </p>
            )}

            {/* إن لم تكن محادثة العميل مربوطة: نطلب الربط برابط البوت مع كود التذكرة (startparam). */}
            {!outcome?.telegramLinked && (
              <a
                href={telegramTicketLink(ticket.id)}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-sky-500/50 bg-sky-500/10 p-3 text-center text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
              >
                اربط تليجرام الآن لاستلام تذكرتك و QR فور اعتمادها ✈️
              </a>
            )}

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
