"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, ExternalLink, Gift, Maximize2, RefreshCcw, Share2, Ticket as TicketIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { QrCode } from "@/components/qr-code"
import { downloadQrPng } from "@/lib/qr-image"
import { formatPrice } from "@/lib/format"
import type { Ticket } from "@/lib/tickets"
import { giftLink, giftMessage, passMapsUrl, passStatus, tierMetal } from "@/lib/ticket-pass"
import { reuploadTicketReceipt } from "@/app/actions/tickets"
import { TicketPassModal } from "@/app/dashboard/tickets/ticket-pass-modal"

/**
 * كارت التذكرة التفاعلي بأسلوب «Boarding Pass» — Dark Graphite & Gold:
 * بيانات العرض والفئة والمقعد + QR + شارة الحالة المضيئة + إجراءات سريعة.
 */

const CARD = "overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"
const BTN = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors"

const TONE_CLASS: Record<string, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_22px_-8px_rgba(16,185,129,0.9)]",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_22px_-8px_rgba(245,158,11,0.9)]",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
  gold: "border-amber-400/50 bg-amber-400/15 text-amber-200 shadow-[0_0_22px_-8px_rgba(251,191,36,0.95)]",
  gray: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
}

export function TicketPassCard({
  ticket,
  allPrices,
  mapsUrl,
  onChanged,
}: {
  ticket: Ticket
  allPrices: number[]
  mapsUrl?: string | null
  onChanged?: () => void
}) {
  const status = passStatus(ticket.status)
  const unitCents = Math.round(ticket.totalCents / Math.max(1, ticket.seats.length))
  const metal = tierMetal(ticket.tierName, unitCents, allPrices)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const shareGift = async () => {
    const url = giftLink(ticket.id, typeof window === "undefined" ? "" : window.location.origin)
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "إهداء تذكرة كواليس", text: giftMessage(ticket), url }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(`${giftMessage(ticket)}\n${url}`).catch(() => undefined)
    setNotice("تم نسخ رابط الإهداء 🎁")
  }

  const handleReupload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.readAsDataURL(file)
    })
    const result = await reuploadTicketReceipt({
      ticketId: ticket.id,
      receiptUrl: dataUrl,
      senderPhone: ticket.senderPhone,
    })
    setUploading(false)
    setNotice(result.ok ? "تم رفع الإيصال — التذكرة عادت لقيد المراجعة ⏳" : result.error ?? "تعذّر الرفع.")
    if (result.ok) onChanged?.()
  }


  return (
    <article className={cn(CARD, "transition-colors hover:border-amber-500/40")}>
      <div className="flex flex-col sm:flex-row">
        <div className="flex flex-1 gap-4 p-4">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-800 sm:h-32 sm:w-24">
            <Image
              src={ticket.posterUrl ?? "/placeholder.svg"}
              alt={`ملصق ${ticket.showTitle}`}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-bold text-zinc-50">{ticket.showTitle}</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">{ticket.venue}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {ticket.startsAt} · <span className="font-mono text-amber-400">{ticket.id}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">
                {metal}
              </span>
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-300">
                {ticket.tierName} · {ticket.seats.join("، ")}
              </span>
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400">
                {formatPrice(ticket.totalCents)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative hidden w-px shrink-0 sm:block">
          <span className="absolute inset-y-3 left-0 border-l border-dashed border-zinc-700" />
        </div>

        <div className="flex flex-col items-center gap-2 border-t border-dashed border-zinc-800 p-4 sm:w-44 sm:border-s sm:border-t-0">
          {status.admitted ? (
            <QrCode payload={ticket.qrCode} size={104} onClick={() => setOpen(true)} title="اضغط لعرض التذكرة كاملة" />
          ) : (
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-700 text-center text-[10px] text-zinc-500">
              <TicketIcon className="h-4 w-4" />
              QR بعد الاعتماد
            </div>
          )}
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", TONE_CLASS[status.tone])}>
            {status.label}
          </span>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 p-3">
        <button type="button" onClick={() => setOpen(true)} className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60")}>
          <Maximize2 className="h-3.5 w-3.5" />
          عرض التذكرة بالكامل
        </button>
        <button
          type="button"
          disabled={!status.admitted}
          onClick={() => void downloadQrPng(ticket.qrCode, `kawalees-ticket-${ticket.id}.png`, 14)}
          className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-40")}
        >
          <Download className="h-3.5 w-3.5" />
          تحميل PDF / صورة
        </button>
        <button type="button" onClick={() => void shareGift()} className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60")}>
          <Gift className="h-3.5 w-3.5" />
          إهداء التذكرة 🎁
        </button>
        <a
          href={passMapsUrl(ticket.venue, mapsUrl)}
          target="_blank"
          rel="noreferrer"
          className={cn(BTN, "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          افتح اللوكيشن 📍
        </a>
        <button type="button" onClick={() => void shareGift()} className={cn(BTN, "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60")}>
          <Share2 className="h-3.5 w-3.5" />
          مشاركة
        </button>

        {ticket.status === "rejected" && (
          <label className={cn(BTN, "cursor-pointer border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20")}>
            <RefreshCcw className={cn("h-3.5 w-3.5", uploading && "animate-spin")} />
            {uploading ? "جارٍ الرفع…" : "إعادة رفع الإيصال 🔄"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleReupload(event.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {notice && (
        <p role="status" className="mx-3 mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
          {notice}
        </p>
      )}

      <TicketPassModal ticket={open ? ticket : null} allPrices={allPrices} onClose={() => setOpen(false)} />
    </article>
  )
}
