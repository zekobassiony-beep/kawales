"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Star, ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { VERIFIED_BADGE_LABEL, reviewsForShow, useReviews } from "@/lib/reviews"
import { useHelpfulReviews, markHelpful } from "@/lib/review-helpful"
import { starDistribution } from "@/lib/show-detail"

/**
 * ملخص تقييم مختصر للهيرو: «4.7 ★ من 143 تقييم» — يُقرأ من مخزن التقييمات الحقيقي.
 */
export function ShowRatingStats({ showId, className }: { showId: string; className?: string }) {
  const reviews = useReviews()
  const list = useMemo(() => reviewsForShow(showId, reviews), [showId, reviews])
  const average = useMemo(() => {
    if (list.length === 0) return 0
    return Math.round((list.reduce((sum, review) => sum + review.rating, 0) / list.length) * 10) / 10
  }, [list])

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300", className)}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {average.toFixed(1)} من {list.length} تقييم
    </span>
  )
}

/** تبويب التقييمات: ملخص رقمي + أعمدة النجوم (5 → 1) + قائمة الجمهور
 * بشارة «حضر العرض» وزر «مفيد» حقيقي.
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

export function ShowReviewsPanel({ showId, showTitle }: { showId: string; showTitle: string }) {
  const reviews = useReviews()
  const list = useMemo(() => reviewsForShow(showId, reviews), [showId, reviews])
  const helpful = useHelpfulReviews()
  const [voted, setVoted] = useState<string[]>([])

  const average = useMemo(() => {
    if (list.length === 0) return 0
    return Math.round((list.reduce((sum, review) => sum + review.rating, 0) / list.length) * 10) / 10
  }, [list])

  const buckets = useMemo(() => starDistribution(list.map((review) => review.rating)), [list])

  return (
    <div className="space-y-5">
      <div className={cn(CARD, "p-5")}>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="font-serif text-5xl font-bold text-amber-400">{average.toFixed(1)}</p>
            <div className="mt-1 flex justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  className={cn("h-4 w-4", value <= Math.round(average) ? "fill-amber-400 text-amber-400" : "text-zinc-600")}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{list.length} تقييم</p>
          </div>

          <ul className="min-w-56 flex-1 space-y-2">
            {buckets.map((bucket) => (
              <li key={bucket.stars} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0 text-zinc-400">{bucket.stars} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="block h-full rounded-full bg-amber-500 shadow-[0_0_14px_-3px_rgba(245,158,11,0.95)]"
                    style={{ width: `${bucket.pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-left font-mono text-zinc-500">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {list.length === 0 ? (
        <p className={cn(CARD, "p-5 text-center text-sm text-zinc-500")}>
          لا توجد تقييمات بعد لعرض «{showTitle}» — كن أول من يحضر ويقيّم.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((review) => {
            const already = voted.includes(review.id)
            return (
              <li key={review.id} className={cn(CARD, "p-5")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 font-serif text-sm font-bold text-amber-400">
                      {review.userName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{review.userName}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(review.createdAt).toLocaleDateString("ar-EG")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={cn("h-3.5 w-3.5", value <= review.rating ? "fill-amber-400 text-amber-400" : "text-zinc-600")}
                        />
                      ))}
                    </span>
                    {review.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        <BadgeCheck className="h-3 w-3" />
                        {VERIFIED_BADGE_LABEL}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{review.comment}</p>

                <button
                  type="button"
                  onClick={() => {
                    if (already) return
                    markHelpful(review.id)
                    setVoted((current) => [...current, review.id])
                  }}
                  disabled={already}
                  className={cn(
                    "mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    already
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/60",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {already ? "شكرًا لتقييمك" : "مفيد"}
                  <span className="font-mono">({helpful[review.id] ?? 0})</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
