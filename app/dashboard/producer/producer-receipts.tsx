"use client"

import { useMemo, useState } from "react"
import { Loader2, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Ticket } from "@/lib/tickets"
import { decideTicketByProducer } from "@/app/actions/tickets"
import { ReceiptPreviewModal } from "@/app/dashboard/producer/producer-receipt-modal"
import { ReceiptRow } from "@/app/dashboard/producer/producer-receipt-row"

/**
 * مركز مراجعة الإيصالات والتحويلات — Dark Graphite & Gold:
 * الطلبات المعلّقة + معاينة الصورة (Modal) + اعتماد فوري / رفض مع تحديد السبب.
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

export function ProducerReceipts({ tickets, onDecided }: { tickets: Ticket[]; onDecided: () => void }) {
  const pending = useMemo(() => tickets.filter((ticket) => ticket.status === "pending"), [tickets])
  const [preview, setPreview] = useState<Ticket | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const decide = async (ticket: Ticket, status: "approved" | "rejected", reason?: string) => {
    setBusy(ticket.id)
    const result = await decideTicketByProducer(ticket.id, status)
    setBusy(null)
    if (!result.ok) {
      setNotice({ tone: "error", text: "تعذّر تحديث الحالة — تحقّق من تسجيل الدخول وتهيئة Supabase." })
      return
    }
    setNotice({
      tone: "ok",
      text:
        status === "approved"
          ? `تم اعتماد وتأكيد التذكرة ${ticket.id} ✓ — صارت موثوقة ورمز QR فعّال.`
          : `تم رفض إيصال ${ticket.id}${reason ? ` — السبب: ${reason}` : ""}.`,
    })
    onDecided()
  }

  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
            <Receipt className="h-4 w-4 text-amber-400" />
            مركز مراجعة الإيصالات
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">تحويلات InstaPay وفودافون كاش والبنك بانتظار الاعتماد.</p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
          {pending.length} إيصال قيد المراجعة
        </span>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-xl border px-4 py-3 text-xs",
            notice.tone === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300",
          )}
        >
          {notice.text}
        </p>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-amber-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          جارٍ تحديث التذكرة في Supabase…
        </p>
      )}

      {pending.length === 0 ? (
        <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center text-xs text-zinc-500">
          لا توجد إيصالات معلّقة — كل التحويلات مُراجَعة ✓
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((ticket) => (
            <ReceiptRow
              key={ticket.id}
              ticket={ticket}
              busy={busy === ticket.id}
              onPreview={setPreview}
              onDecide={(item, status, reason) => void decide(item, status, reason)}
            />
          ))}
        </ul>
      )}

      <ReceiptPreviewModal ticket={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
