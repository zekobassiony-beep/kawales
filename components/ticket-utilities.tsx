"use client"

import { CalendarPlus, Download, Printer, QrCode as QrCodeIcon, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { googleCalendarUrl } from "@/lib/calendar"
import { QR_QUIET_ZONE, qrMatrix } from "@/lib/qr"
import { downloadQrPng } from "@/lib/qr-image"
import { paymentMethodLabel, telegramTicketLink, type Ticket } from "@/lib/tickets"

/**
 * أدوات تذكرة الجمهور: إضافة إلى تقويم جوجل، حفظ التذكرة كصورة، وطباعة/PDF —
 * للوصول السريع إليها عند بوابة المسرح.
 */

export function TicketUtilityButtons({ ticket, className }: { ticket: Ticket; className?: string }) {
  const calendarHref = ticket.startsAtIso
    ? googleCalendarUrl({
        title: `عرض ${ticket.showTitle} — كواليس`,
        location: ticket.venue,
        details: `المرجع: ${ticket.id}\nالمقاعد: ${ticket.seats.join("، ")}\nالكود عند البوابة: ${ticket.id}`,
        startIso: ticket.startsAtIso,
        durationMinutes: 90,
      })
    : "#"

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ticket.startsAtIso && (
        <a
          href={calendarHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          أضف إلى تقويم جوجل 📅
        </a>
      )}
      {(ticket.status === "approved" || ticket.status === "checked_in") && (
        <button
          type="button"
          onClick={() => void downloadQrPng(ticket.qrCode, `kawalees-qr-${ticket.id}.png`, 14)}
          className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <QrCodeIcon className="h-3.5 w-3.5" />
          تنزيل رمز QR 🔳
        </button>
      )}
      <button
        type="button"
        onClick={() => saveTicketAsImage(ticket)}
        className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
      >
        <Download className="h-3.5 w-3.5" />
        حفظ التذكرة كصورة 📥
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
      >
        <Printer className="h-3.5 w-3.5" />
        طباعة / حفظ PDF
      </button>
      {/* ربط العميل ببوت كواليس على تليجرام مع إرفاق كود التذكرة (نفس الآلية في كلا مساري الحجز). */}
      <a
        href={telegramTicketLink(ticket.id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20"
      >
        <Send className="h-3.5 w-3.5" />
        ربط تليجرام ومتابعة التذكرة ✈️
      </a>
    </div>
  )
}

/* ---------- رسم التذكرة على Canvas وحفظها كصورة PNG ---------- */

const TICKET_W = 1080
const TICKET_H = 560

async function saveTicketAsImage(ticket: Ticket): Promise<void> {
  const canvas = document.createElement("canvas")
  canvas.width = TICKET_W
  canvas.height = TICKET_H
  const context = canvas.getContext("2d")
  if (!context) return

  // خلفية داكنة بهوية كواليس + إطار ذهبي.
  const gradient = context.createLinearGradient(0, 0, TICKET_W, TICKET_H)
  gradient.addColorStop(0, "#150c22")
  gradient.addColorStop(1, "#2a1206")
  context.fillStyle = gradient
  context.fillRect(0, 0, TICKET_W, TICKET_H)
  context.strokeStyle = "#facc15"
  context.lineWidth = 6
  roundRect(context, 20, 20, TICKET_W - 40, TICKET_H - 40, 28)
  context.stroke()

  context.textAlign = "left"
  context.direction = "ltr"

  // الشعار.
  context.fillStyle = "#facc15"
  context.font = "bold 44px system-ui, 'Segoe UI', sans-serif"
  context.fillText("Kawalees كواليس", 60, 90)

  context.fillStyle = "#f8fafc"
  context.font = "bold 52px system-ui, 'Segoe UI', sans-serif"
  context.fillText(ticket.showTitle, 60, 170, 640)

  context.fillStyle = "#cbd5e1"
  context.font = "28px system-ui, 'Segoe UI', sans-serif"
  context.fillText(`${ticket.venue} · ${ticket.startsAt}`, 60, 230, 640)
  context.fillText(`المقاعد: ${ticket.seats.join("، ")}`, 60, 280, 640)
  context.fillText(`الفئة: ${ticket.tierName} · الدفع: ${paymentMethodLabel(ticket.paymentMethod)}`, 60, 330, 640)

  context.fillStyle = "#facc15"
  context.font = "bold 40px monospace"
  context.fillText(ticket.id, 60, 410)

  // رمز QR الحقيقي مع منطقة هدوء (يُرسم فقط بعد قبول الإدارة أو تسجيل الحضور).
  const verified = ticket.status === "approved" || ticket.status === "checked_in"
  if (verified) {
    const matrix = qrMatrix(ticket.qrCode)
    const modules = matrix.length
    const quiet = QR_QUIET_ZONE
    const total = modules + quiet * 2
    const box = 220
    const cell = box / total
    const originX = TICKET_W - 60 - box
    const originY = 270
    context.fillStyle = "#ffffff"
    context.fillRect(originX - 8, originY - 8, box + 16, box + 16)
    context.fillStyle = "#0b1020"
    matrix.forEach((row, rowIndex) => {
      row.forEach((filled, columnIndex) => {
        if (filled) {
          context.fillRect(
            originX + (columnIndex + quiet) * cell,
            originY + (rowIndex + quiet) * cell,
            cell + 0.6,
            cell + 0.6,
          )
        }
      })
    })
  } else {
    context.fillStyle = "#475569"
    context.font = "20px system-ui, 'Segoe UI', sans-serif"
    context.fillText("QR يُفتح بعد قبول الإدارة", TICKET_W - 60 - 240, 370)
  }

  context.direction = "rtl"

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `kawalees-ticket-${ticket.id}.png`
  anchor.click()
  URL.revokeObjectURL(url)
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}
