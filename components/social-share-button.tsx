"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Download, Loader2, MessageCircle, Share2, ThumbsUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SocialCardPreview,
  socialCardFile,
  socialShareText,
  type SocialCardData,
} from "@/components/social-card-generator"

/**
 * زر المشاركة الذكي (1-Click Web Share API):
 *  - على الموبايل: يفتح قائمة المشاركة الأصلية (`navigator.share`) ويمرّر
 *    صورة الكارت المنسّقة + النص التلقائي مباشرة إلى واتساب/ستوري إنستجرام/فيسبوك.
 *  - على الكمبيوتر (Fallback): نافذة أنيقة فيها واتساب ويب وفيسبوك + زر تحميل
 *    صورة الكارت + زر نسخ الرابط.
 */

const SHARE_SITE_URL = "https://kawalees.com"

export function SocialShareButton({
  data,
  label = "شارك الآن 📲",
  className,
}: {
  data: SocialCardData
  /** نص الزر — الافتراضي «شارك الآن 📲» ويُخصَّص لكل لوحة. */
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const shareText = socialShareText(data)

  const handleClick = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const file = await socialCardFile(data)
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
      if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: shareText, title: data.showTitle, url: SHARE_SITE_URL })
          setNotice("تم فتح قائمة المشاركة 📲")
        } catch (error) {
          // إلغاء المستخدم للمشاركة لا يُعد خطأ.
          if (!(error instanceof DOMException && error.name === "AbortError")) setFallbackOpen(true)
        }
      } else {
        setFallbackOpen(true)
      }
    } catch {
      setNotice("تعذّر توليد صورة الكارت — حاول مرة أخرى.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50",
          className,
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        {busy ? "جارٍ تجهيز الكارت…" : label}
      </button>

      {notice && (
        <p role="status" className="mt-2 text-[11px] text-emerald-300">
          {notice}
        </p>
      )}

      {fallbackOpen && (
        <ShareFallbackDialog
          data={data}
          text={shareText}
          onClose={() => setFallbackOpen(false)}
        />
      )}
    </>
  )
}

/** نافذة المشاركة البديلة على الكمبيوتر: شبكات مباشرة + تحميل + نسخ الرابط. */
function ShareFallbackDialog({ data, text, onClose }: { data: SocialCardData; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const cleanText = text.replace(/\n/g, " ")
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${cleanText}\n${SHARE_SITE_URL}`)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_SITE_URL)}&quote=${encodeURIComponent(cleanText)}`

  /* الإغلاق بمفتاح Escape — سلوك نافذة حوار معياري. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const handleDownload = async () => {
    try {
      const file = await socialCardFile(data)
      const url = URL.createObjectURL(file)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      // تجاهل: فشل التوليد نادر.
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${cleanText} ${SHARE_SITE_URL}`).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold">شارك كارت كواليس</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.mode === "customer" ? "أنا حاضر مسرحية" : "انضممت رسمياً لطاقم"} {data.showTitle}
            </p>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <SocialCardPreview data={data} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            واتساب ويب
          </a>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-[#1877F2] px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ThumbsUp className="h-4 w-4" />
            فيسبوك
          </a>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            <Download className="h-4 w-4" />
            تحميل صورة الكارت 📥
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم نسخ الرابط" : "نسخ الرابط 🔗"}
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          على الموبايل يفتح زر المشاركة قائمة النظام مباشرة لتمرير الكارت إلى إنستجرام أو واتساب أو فيسبوك بضغطة واحدة.
        </p>
      </div>
    </div>
  )
}

