"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { FLASH_TONES, hideFlashBanner, useFlashBanner } from "@/lib/flash-banner"

/**
 * نشرة التنبيهات العاجلة أعلى الموقع — تظهر فقط عند تفعيلها من لوحة العمليات
 * `/hq-kawalees`، مع زر إغلاق فوري للزائر.
 */
export function FlashBanner() {
  const banner = useFlashBanner()
  if (!banner.enabled || banner.text.trim().length === 0) return null

  const tone = FLASH_TONES[banner.tone]

  return (
    <div className={cn("relative w-full px-10 py-2 text-center text-xs font-medium sm:text-sm", tone.className)} role="status">
      <span className="me-2">{tone.emoji}</span>
      {banner.text}
      {banner.linkUrl && (
        <Link href={banner.linkUrl} className="ms-2 underline underline-offset-4 hover:opacity-90">
          {banner.linkLabel ?? "اعرف المزيد"}
        </Link>
      )}
      <button
        type="button"
        aria-label="إغلاق التنبيه"
        onClick={() => hideFlashBanner()}
        className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 transition-colors hover:bg-black/35"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
