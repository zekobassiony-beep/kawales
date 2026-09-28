"use client"

import { useEffect, useState } from "react"
import { ImageIcon, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { QrCode } from "@/components/qr-code"
import { applyServerTicketUpdate, isTicketAccepted, normalizeTicketStatus, type Ticket, type TicketStatus } from "@/lib/tickets"

/** الفاصل بين محاولات جلب صورة التذكرة/الحالة من السيرفر. */
const POLL_INTERVAL_MS = 5000
/** أقصى عدد محاولات قبل إظهار حالة «تعذّر الجلب» بدل دوران لا نهائي. */
const MAX_ATTEMPTS = 24

/**
 * «معرض/عرض» صورة التذكرة في الموقع:
 * يستطلع حالة التذكرة من `/api/tickets/status` — فور اعتماد الإدارة للتحويل على
 * تليجرام تتحول الحالة هنا إلى «مقبول» تلقائيًا وتظهر صورة التذكرة/QR التي
 * يولّدها البوت (`ticket_image_url`) بلا حاجة لتحديث الصفحة.
 */
export function TicketQrViewer({
  ticket,
  size = 180,
  className,
}: {
  ticket: Ticket
  size?: number
  className?: string
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [imageUrl, setImageUrl] = useState<string | null>(ticket.ticketImageUrl ?? null)
  const [stalled, setStalled] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const admitted = isTicketAccepted(status)

  // مزامنة فورية لما يصل من الأعلى (استطلاع اللوحة أو نافذة أخرى).
  useEffect(() => {
    setStatus(ticket.status)
    if (ticket.ticketImageUrl) setImageUrl(ticket.ticketImageUrl)
  }, [ticket.id, ticket.status, ticket.ticketImageUrl])

  useEffect(() => {
    if (imageUrl) return
    let active = true
    let attempts = 0
    let timer: number | undefined

    const load = async () => {
      attempts += 1
      try {
        const response = await fetch(`/api/tickets/status?id=${encodeURIComponent(ticket.id)}`, {
          cache: "no-store",
        })
        const data = (await response.json()) as { status?: TicketStatus; imageUrl?: string | null }
        if (!active) return
        if (data.status) {
          const nextStatus = normalizeTicketStatus(data.status)
          setStatus(nextStatus)
          // تحديث المخزن المحلي أيضًا ليتغيّر كامل الواجهة (الشارات، لوحة العميل…).
          applyServerTicketUpdate({
            id: ticket.id,
            status: nextStatus,
            ticketImageUrl: data.imageUrl ?? null,
          })
        }
        if (data.imageUrl) {
          setImageUrl(data.imageUrl)
          return
        }
      } catch {
        // فشل شبكي عابر — نُعيد المحاولة في النبضة التالية.
      }
      if (!active) return
      if (attempts >= MAX_ATTEMPTS) {
        setStalled(true)
        return
      }
      timer = window.setTimeout(load, POLL_INTERVAL_MS)
    }

    void load()
    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
    }
  }, [ticket.id, imageUrl, reloadKey])

  if (imageUrl) {
    return (
      <span className={cn("inline-block overflow-hidden rounded-2xl bg-white p-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`صورة تذكرة ${ticket.id} من تليجرام`}
          width={size}
          height={size}
          className="block h-auto w-auto"
        />
      </span>
    )
  }

  const waiting = admitted && !stalled
  const hint = admitted
    ? stalled
      ? "تعذّر جلب صورة التذكرة من تليجرام — أعد المحاولة أو تواصل مع الدعم."
      : "جارٍ جلب صورة التذكرة من تليجرام…"
    : status === "rejected"
      ? "الإيصال مرفوض — أعد رفع إيصال صحيح ليعتمده فريق كواليس."
      : "صورة التذكرة و QR يفعّلهما تليجرام فور اعتماد الإيصال"

  return (
    <span className="relative inline-flex flex-col items-center gap-1">
      <QrCode payload={ticket.qrCode} size={size} className={cn(!admitted && "opacity-25 blur-[2px]", className)} />
      {(!admitted || waiting) && (
        <span className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-background/70 px-3 text-center text-[10px] leading-snug text-muted-foreground">
          {admitted ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {hint}
        </span>
      )}
      {stalled && (
        <button
          type="button"
          onClick={() => {
            setStalled(false)
            setReloadKey((value) => value + 1)
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-secondary/40"
        >
          <RefreshCw className="h-3 w-3" /> إعادة المحاولة
        </button>
      )}
    </span>
  )
}
