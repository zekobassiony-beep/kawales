"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * مُولّد كروت السوشيال ميديا (Dynamic Story Cards) بهوية «كواليس».
 *
 * يرسم على HTML5 Canvas كارتًا رأسيًا (1080×1920 بأبعاد الستوري) يحتوي الشعار
 * وألوان المسرح والبوستر، بوضعين:
 *  - **نمط العميل:** «أنا حاضر مسرحية …» مع الاسم والتاريخ والمسرح ورقم المقعد.
 *  - **نمط الممثل:** «انضممت رسميًا لطاقم عمل …» مع صورة الممثل ودوره.
 * ويعيد الكارت كـ `Blob` جاهزًا للمشاركة عبر Web Share API أو للتحميل.
 */

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

/** هوية كواليس: خلفية مسرح داكنة + ذهبي دافئ. */
export const CARD_COLORS = {
  backdropTop: "#150c22",
  backdropBottom: "#2a1206",
  curtain: "#4c0d16",
  spotlight: "rgba(250, 204, 21, 0.18)",
  gold: "#facc15",
  goldSoft: "#fde68a",
  text: "#f8fafc",
  muted: "#cbd5e1",
  card: "rgba(2, 6, 23, 0.55)",
} as const

export type SocialCardMode = "customer" | "actor"

export type SocialCardData = {
  mode: SocialCardMode
  showTitle: string
  posterUrl?: string
  /** نمط العميل. */
  customerName?: string
  seatLabel?: string
  dateLabel?: string
  venueLabel?: string
  /** نمط الممثل. */
  actorName?: string
  actorImageUrl?: string
  roleLabel?: string
  /** تذييل اختياري (كود التذكرة مثلًا). */
  footnote?: string
}

/** العبارة الحماسية لكل نمط — تُستعمل على الكارت وفي نص المشاركة. */
export function socialCardHeadline(data: SocialCardData): string {
  return data.mode === "customer"
    ? `أنا حاضر مسرحية ${data.showTitle} 🎭`
    : `انضممت رسمياً لطاقم عمل ${data.showTitle} 🌟`
}

/** النص التلقائي المرفق مع المشاركة. */
export function socialShareText(data: SocialCardData): string {
  const lines = [socialCardHeadline(data)]
  if (data.mode === "customer") {
    if (data.venueLabel) lines.push(`📍 ${data.venueLabel}`)
    if (data.dateLabel) lines.push(`🗓️ ${data.dateLabel}`)
    if (data.seatLabel) lines.push(`🪑 مقعد: ${data.seatLabel}`)
  } else {
    if (data.roleLabel) lines.push(`🎬 الدور/المهمة: ${data.roleLabel}`)
    if (data.venueLabel) lines.push(`📍 ${data.venueLabel}`)
  }
  lines.push("احجز تذكرتك على كواليس 🎟️")
  return lines.join("\n")
}

const POSTER_FALLBACK_GRADIENT: [string, string] = ["#3b0764", "#7c2d12"]

/** يحمّل صورة (مع دعم CORS) ويعيدها، أو `null` عند فشل التحميل. */
function loadImage(source?: string): Promise<HTMLImageElement | null> {
  if (!source) return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = source
  })
}

/** قصّ الصورة لتغطية مستطيل محدد (cover) مع الحفاظ على النِسب. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

function roundedPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

function drawCircleImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  radius: number,
) {
  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.closePath()
  context.clip()
  context.drawImage(image, centerX - radius, centerY - radius, radius * 2, radius * 2)
  context.restore()
}


/* ---------- محرك الرسم ---------- */

const ARABIC_FONT = "system-ui, 'Segoe UI', Tahoma, sans-serif"

/** يرسم كارت الستوري كاملًا على الـ context المُمرَّر (للمعاينة والتوليد معًا). */
export async function drawSocialCard(context: CanvasRenderingContext2D, data: SocialCardData): Promise<void> {
  const [poster, avatar] = await Promise.all([
    loadImage(data.posterUrl),
    loadImage(data.mode === "actor" ? data.actorImageUrl : undefined),
  ])

  context.textAlign = "center"
  context.textBaseline = "middle"
  context.direction = "rtl"

  /* 1) الخلفية: تدرّج مسرحي + ستارة + بقعة ضوء. */
  const backdrop = context.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  backdrop.addColorStop(0, CARD_COLORS.backdropTop)
  backdrop.addColorStop(1, CARD_COLORS.backdropBottom)
  context.fillStyle = backdrop
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  context.fillStyle = CARD_COLORS.curtain
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(CARD_WIDTH * 0.28, 0)
  context.quadraticCurveTo(CARD_WIDTH * 0.16, CARD_HEIGHT * 0.4, 0, CARD_HEIGHT * 0.62)
  context.closePath()
  context.fill()
  context.beginPath()
  context.moveTo(CARD_WIDTH, 0)
  context.lineTo(CARD_WIDTH * 0.72, 0)
  context.quadraticCurveTo(CARD_WIDTH * 0.84, CARD_HEIGHT * 0.4, CARD_WIDTH, CARD_HEIGHT * 0.62)
  context.closePath()
  context.fill()

  const spotlight = context.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT * 0.3, 60, CARD_WIDTH / 2, CARD_HEIGHT * 0.34, CARD_WIDTH)
  spotlight.addColorStop(0, CARD_COLORS.spotlight)
  spotlight.addColorStop(1, "rgba(0,0,0,0)")
  context.fillStyle = spotlight
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  /* 2) الشعار. */
  context.fillStyle = CARD_COLORS.gold
  context.font = `bold 78px ${ARABIC_FONT}`
  context.fillText("كواليس", CARD_WIDTH / 2, 118)
  context.fillStyle = CARD_COLORS.muted
  context.font = `500 34px ${ARABIC_FONT}`
  context.fillText("KAWALEES · مسرح مصر المستقل", CARD_WIDTH / 2, 182)

  /* 3) البوستر داخل إطار ذهبي (أو تدرّج بديل عند فشل التحميل). */
  const posterX = CARD_WIDTH / 2 - 340
  const posterY = 250
  const posterWidth = 680
  const posterHeight = 880

  context.save()
  roundedPath(context, posterX, posterY, posterWidth, posterHeight, 42)
  context.clip()
  if (poster) {
    drawCover(context, poster, posterX, posterY, posterWidth, posterHeight)
  } else {
    const fallback = context.createLinearGradient(posterX, posterY, posterX + posterWidth, posterY + posterHeight)
    fallback.addColorStop(0, POSTER_FALLBACK_GRADIENT[0])
    fallback.addColorStop(1, POSTER_FALLBACK_GRADIENT[1])
    context.fillStyle = fallback
    context.fillRect(posterX, posterY, posterWidth, posterHeight)
    context.fillStyle = CARD_COLORS.goldSoft
    context.font = `bold 120px ${ARABIC_FONT}`
    context.fillText("🎭", CARD_WIDTH / 2, posterY + posterHeight / 2)
  }
  context.restore()

  context.strokeStyle = CARD_COLORS.gold
  context.lineWidth = 8
  roundedPath(context, posterX, posterY, posterWidth, posterHeight, 42)
  context.stroke()

  /* 4) العبارة الحماسية واسم العرض. */
  context.fillStyle = CARD_COLORS.text
  context.font = `bold 54px ${ARABIC_FONT}`
  context.fillText(socialCardHeadline(data), CARD_WIDTH / 2, posterY + posterHeight + 110, CARD_WIDTH - 140)
  context.fillStyle = CARD_COLORS.gold
  context.font = `bold 50px ${ARABIC_FONT}`
  context.fillText(data.showTitle, CARD_WIDTH / 2, posterY + posterHeight + 192, CARD_WIDTH - 160)

  /* 5) لوحة التفاصيل (الزجاج الداكن). */
  const panelY = posterY + posterHeight + 260
  const panelX = 90
  const panelWidth = CARD_WIDTH - 180
  const isCustomer = data.mode === "customer"
  const rows: { label: string; value: string }[] = isCustomer
    ? [
        { label: "الاسم", value: data.customerName || "ضيف كواليس" },
        { label: "المسرح", value: data.venueLabel || "—" },
        { label: "التاريخ", value: data.dateLabel || "—" },
        { label: "المقعد", value: data.seatLabel || "فئة مفتوحة" },
      ]
    : [
        { label: "الممثل", value: data.actorName || "عضو الطاقم" },
        { label: "الدور / المهمة", value: data.roleLabel || "طاقم العمل" },
        { label: "المسرح", value: data.venueLabel || "يحدد لاحقاً" },
      ]
  const rowHeight = 96
  const panelHeight = rows.length * rowHeight + 60

  context.fillStyle = CARD_COLORS.card
  roundedPath(context, panelX, panelY, panelWidth, panelHeight, 36)
  context.fill()
  context.strokeStyle = "rgba(250, 204, 21, 0.35)"
  context.lineWidth = 3
  roundedPath(context, panelX, panelY, panelWidth, panelHeight, 36)
  context.stroke()

  rows.forEach((row, index) => {
    const centerY = panelY + 60 + index * rowHeight
    context.textAlign = "right"
    context.fillStyle = CARD_COLORS.muted
    context.font = `500 36px ${ARABIC_FONT}`
    context.fillText(row.label, panelX + panelWidth - 45, centerY)
    context.textAlign = "left"
    context.fillStyle = CARD_COLORS.text
    context.font = `bold 40px ${ARABIC_FONT}`
    context.fillText(row.value, panelX + 45, centerY, panelWidth - 420)
  })
  context.textAlign = "center"

  /* 6) صورة الممثل الدائرية (نمط الممثل فقط). */
  if (!isCustomer) {
    const centerX = CARD_WIDTH / 2
    const centerY = panelY + panelHeight + 150
    context.save()
    context.beginPath()
    context.arc(centerX, centerY, 132, 0, Math.PI * 2)
    context.fillStyle = "rgba(2, 6, 23, 0.7)"
    context.fill()
    context.strokeStyle = CARD_COLORS.gold
    context.lineWidth = 6
    context.stroke()
    if (avatar) {
      drawCircleImage(context, avatar, centerX, centerY, 124)
    } else {
      context.fillStyle = CARD_COLORS.goldSoft
      context.font = `bold 96px ${ARABIC_FONT}`
      context.fillText("🌟", centerX, centerY)
    }
    context.restore()
  }

  /* 7) التذييل: رابط المنصة + كود اختياري. */
  const footerY = CARD_HEIGHT - 110
  context.fillStyle = CARD_COLORS.goldSoft
  context.font = `bold 40px ${ARABIC_FONT}`
  context.fillText("kawalees.com · #كواليس", CARD_WIDTH / 2, footerY)
  if (data.footnote) {
    context.fillStyle = CARD_COLORS.muted
    context.font = `500 34px ${ARABIC_FONT}`
    context.fillText(data.footnote, CARD_WIDTH / 2, footerY - 64)
  }
  context.direction = "ltr"
}

/** يولّد الكارت كـ `Blob` بصيغة PNG (جاهز للمشاركة أو التنزيل). */
export async function generateSocialCard(data: SocialCardData): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext("2d")
  if (!context) throw new Error("تعذّر تجهيز الكارت")
  await drawSocialCard(context, data)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("تعذّر توليد صورة الكارت"))
    }, "image/png")
  })
}

/** يحوّل الكارت إلى ملف صورة جاهز لـ `navigator.share`. */
export async function socialCardFile(data: SocialCardData): Promise<File> {
  const blob = await generateSocialCard(data)
  return new File([blob], `kawalees-${data.mode}-card.png`, { type: "image/png" })
}

/* ---------- معاينة الكارت ---------- */

/** معاينة حيّة للكارت على Canvas بنفس أبعاد الستوري. */
export function SocialCardPreview({ data, className }: { data: SocialCardData; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(true)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CARD_WIDTH
    canvas.height = CARD_HEIGHT
    const context = canvas.getContext("2d")
    if (!context) return
    setDrawing(true)
    drawSocialCard(context, data)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDrawing(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    data.mode,
    data.showTitle,
    data.posterUrl,
    data.customerName,
    data.seatLabel,
    data.dateLabel,
    data.venueLabel,
    data.actorName,
    data.actorImageUrl,
    data.roleLabel,
    data.footnote,
    data,
  ])

  return (
    <div className={cn("relative mx-auto w-full max-w-[220px]", className)}>
      <canvas ref={canvasRef} className="h-auto w-full rounded-xl border border-border/60 shadow-lg" />
      {drawing && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 text-xs text-muted-foreground">
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          جارٍ رسم الكارت…
        </span>
      )}
    </div>
  )
}

/** أيقونة الشعار المستخدمة في أزرار المشاركة. */
export function ShareIcon({ className }: { className?: string }) {
  return <Share2 className={className} />
}

