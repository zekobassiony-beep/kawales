"use client"

import { X } from "lucide-react"
import { QrCode } from "@/components/qr-code"
import { formatPrice } from "@/lib/format"
import { paymentMethodLabel, type Ticket } from "@/lib/tickets"
import { ATTENDANCE_POLICY, tierMetal } from "@/lib/ticket-pass"

/** نافذة التذكرة المطبوعة: كارت سينمائي بحدود مخرمة + QR كبير + سياسة الحضور. */
export function TicketPassModal({
  ticket,
  allPrices,
  onClose,
}: {
  ticket: Ticket | null
  allPrices: number[]
  onClose: () => void
}) {
  if (!ticket) return null
  const metal = tierMetal(ticket.tierName, ticket.totalCents, allPrices)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تذكرة ${ticket.id}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/30 bg-zinc-900 shadow-[0_0_60px_-20px_rgba(245,158,11,0.8)]">
        <div className="relative border-b border-dashed border-zinc-700 bg-amber-500/10 p-4 text-center">
          <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-950" />
          <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-950" />
          <p className="font-serif text-lg font-bold text-amber-300">{ticket.showTitle}</p>
          <p className="mt-0.5 text-[11px] text-zinc-300">{ticket.venue}</p>
        </div>

        <div className="space-y-3 p-4">
          <div className="mx-auto rounded-2xl bg-white p-2">
            <QrCode payload={ticket.qrCode} size={240} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
            <span>
              الكود: <span className="font-mono text-amber-300">{ticket.id}</span>
            </span>
            <span>الفئة: {metal}</span>
            <span>المقاعد: {ticket.seats.join("، ")}</span>
            <span>الدفع: {paymentMethodLabel(ticket.paymentMethod)}</span>
            <span>التاريخ: {ticket.startsAt}</span>
            <span>الإجمالي: {formatPrice(ticket.totalCents)}</span>
          </div>

          <ul className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[10px] leading-relaxed text-zinc-400">
            {ATTENDANCE_POLICY.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-800 py-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800/60"
        >
          <X className="h-3.5 w-3.5" />
          إغلاق
        </button>
      </div>
    </div>
  )
}
