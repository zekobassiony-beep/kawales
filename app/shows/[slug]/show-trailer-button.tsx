"use client"

import { useState } from "react"
import { Play, X } from "lucide-react"

/**
 * زر تشغيل التريلر في هيرو صفحة العرض + نافذة فيديو (Modal):
 * يعرض برومو العرض عبر iframe إن وُجد رابط، وإلا يعرض البوستر مع رسالة توضيحية.
 */
export function ShowTrailerButton({
  title,
  posterUrl,
  trailerUrl,
}: {
  title: string
  posterUrl: string
  trailerUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const embedUrl = trailerUrl?.trim() || ""

  return (
    <>
      <button
        type="button"
        aria-label={`تشغيل تريلر ${title}`}
        onClick={() => setOpen(true)}
        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/50 bg-zinc-950/70 text-amber-400 shadow-[0_0_40px_-10px_rgba(245,158,11,0.95)] backdrop-blur transition-transform hover:scale-105 sm:h-16 sm:w-16"
      >
        <Play className="h-6 w-6" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`تريلر ${title}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur"
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="truncate text-sm font-semibold text-zinc-100">برومو {title}</p>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full bg-zinc-950">
              {embedUrl.includes("youtube.com/embed") || embedUrl.includes("youtube-nocookie.com/embed") ? (
                <iframe
                  src={embedUrl}
                  title={`تريلر ${title}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={posterUrl} alt={title} className="max-h-48 rounded-xl object-contain opacity-70" />
                  <p className="text-xs text-zinc-400">
                    لا يوجد برومو فيديو لهذا العرض بعد — تابع صفحة العرض لمعرفة التفاصيل والمواعيد.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
