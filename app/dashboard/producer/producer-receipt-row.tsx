"use client"

import { useState } from "react"
import { Check, Eye, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { StatusBadge } from "@/app/dashboard/ui"
import { paymentMethodLabel, type Ticket } from "@/lib/tickets"
import { RECEIPT_REJECTION_REASONS } from "@/lib/producer-metrics"

/** صف إيصال واحد في مركز المراجعة: التفاصيل + معاينة + اعتماد/رفض مع السبب. */

const BTN = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors"

export function ReceiptRow({
  ticket,
  busy,
  onPreview,
  onDecide,
}: {
  ticket: Ticket
  busy: boolean
  onPreview: (ticket: Ticket) => void
  onDecide: (ticket: Ticket, status: "approved" | "rejected", reason?: string) => void
}) {
  const [reason, setReason] = useState(RECEIPT_REJECTION_REASONS[0])

  return (
    <li className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            {ticket.customerName || "عميل كواليس"}{" "}
            <span className="font-mono text-[11px] text-amber-400">{ticket.id}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {ticket.showTitle} · {ticket.tierName} · {ticket.seats.join("، ")}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {paymentMethodLabel(ticket.paymentMethod)}
            {ticket.senderPhone ? ` · المحوّل: ${ticket.senderPhone}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-lg font-bold text-amber-400">{formatPrice(ticket.totalCents)}</p>
          <StatusBadge tone="amber">قيد المراجعة</StatusBadge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(ticket)}
          className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60")}
        >
          <Eye className="h-3.5 w-3.5" />
          معاينة الإيصال
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(ticket, "approved")}
          className={cn(
            BTN,
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50",
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          اعتماد وتأكيد TICKET 🟢
        </button>

        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label="سبب الرفض"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-300 outline-none transition-colors focus:border-amber-500"
        >
          {RECEIPT_REJECTION_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(ticket, "rejected", reason)}
          className={cn(BTN, "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50")}
        >
          <X className="h-3.5 w-3.5" />
          رفض الإيصال 🔴
        </button>
      </div>
    </li>
  )
}
