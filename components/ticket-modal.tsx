"use client"

import { useEffect, useState } from "react"
import { Download, Maximize2, X } from "lucide-react"
import { QrCode } from "@/components/qr-code"
import { downloadQrPng } from "@/lib/qr-image"
import { formatPrice } from "@/lib/format"
import type { Ticket } from "@/lib/tickets"

/**
 * نافذة التذكرة: تعرض رمز QR بحجم كامل على خلفية بيضاء صريحة داخل إطار
 * سينمائي، مع إمكانية تنزيل الرمز كصورة عالية الدقة (PNG).
 */
export function TicketModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  /* الإغلاق بمفتاح Escape. */
  useEffect(() => {
    if (!ticket) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [ticket, onClose])

  if (!ticket) return null

  const handleDownload = async () => {
    setBusy(true)
    try {
      await downloadQrPng(ticket.qrCode, `kawalees-qr-${ticket.id}.png`, 14)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`رمز QR للتذكرة ${ticket.id}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-primary/40 bg-card shadow-2xl">
        {/* شريط علوي سينمائي */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-l from-primary/15 via-transparent to-transparent px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Maximize2 className="h-3.5 w-3.5" />
              رمز الدخول
            </p>
            <h3 className="mt-1 truncate font-serif text-lg font-bold">{ticket.showTitle}</h3>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex justify-center rounded-2xl bg-white p-2">
            <QrCode payload={ticket.qrCode} size={300} />
          </div>

          <div className="grid gap-1 text-center text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">الكود:</span>{" "}
              <span className="font-mono" dir="ltr">
                {ticket.id}
              </span>
            </p>
            <p>
              <span className="font-medium text-foreground">المقاعد:</span> {ticket.seats.join("، ")} · {ticket.tierName}
            </p>
            <p>
              {ticket.venue} · {ticket.startsAt} · {formatPrice(ticket.totalCents)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {busy ? "جارٍ التجهيز…" : "تنزيل صورة الرمز"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border/60 px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
            >
              إغلاق
            </button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            اعرض هذا الرمز عند بوابة المسرح — تأكد من سطوع الشاشة وعدم وجود انعكاسات.
          </p>
        </div>
      </div>
    </div>
  )
}
