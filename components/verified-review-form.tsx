"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Lock, Send, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/session"
import { useTickets } from "@/lib/tickets"
import {
  REVIEWS_LOCKED_NOTICE,
  VERIFIED_BADGE_LABEL,
  addReview,
  averageRating,
  canUserReviewShow,
  hasUserReviewed,
  reviewsForShow,
  useReviews,
} from "@/lib/reviews"

/**
 * التقييمات الموثقة (Verified Reviews):
 *  - نموذج تقييم بالنجوم يظهر **فقط** لمن حضر العرض فعلًا (تذكرة `checked_in`).
 *  - شريط تنبيه لمن لم يحضر بعد.
 *  - قائمة تقييمات شفافة مع الشارة الذهبية «جمهور موثق — حضر العرض 🏅».
 */

export function VerifiedReviewForm({
  showId,
  showTitle,
  className,
}: {
  showId: string
  showTitle: string
  className?: string
}) {
  const session = useSession()
  const reviews = useReviews()
  const tickets = useTickets()
  const userId = session?.email ?? ""
  const userName = session?.profile.fullName || session?.name || "جمهور كواليس"

  const allowed = useMemo(() => canUserReviewShow(userId, showId, tickets), [userId, showId, tickets, reviews])
  const alreadyReviewed = useMemo(() => hasUserReviewed(userId, showId, reviews), [userId, showId, reviews])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  if (!allowed) {
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100", className)}>
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{REVIEWS_LOCKED_NOTICE}</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border border-primary/40 bg-card p-5", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BadgeCheck className="h-4 w-4 text-emerald-400" />
        {alreadyReviewed ? "تحديث تقييمك الموثق" : "اكتب تقييمك الموثق"}
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        تقييمك مربوط بتذكرة حضرت بها {showTitle} — يظهر بجواره شارة «{VERIFIED_BADGE_LABEL}».
      </p>

      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} من 5 نجوم`}
            aria-pressed={rating === value}
            onClick={() => setRating(value)}
            className="transition-transform hover:scale-110"
          >
            <Star className={cn("h-6 w-6", value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          </button>
        ))}
        <span className="ms-2 text-xs text-muted-foreground">{rating} / 5</span>
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder="كيف كانت تجربتك مع العرض؟ الأداء، الإخراج، القاعة…"
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const result = addReview({ userId, userName, showId, rating, comment })
            setNotice({ ok: result.ok, text: result.message })
            if (result.ok) setComment("")
          }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Send className="h-4 w-4" />
          {alreadyReviewed ? "تحديث التقييم" : "نشر التقييم"}
        </button>
        {notice && (
          <p className={cn("text-xs", notice.ok ? "text-emerald-300" : "text-destructive-foreground")}>{notice.text}</p>
        )}
      </div>
    </div>
  )
}


/** قائمة التقييمات الشفافة مع الشارة الذهبية «جمهور موثق». */
export function ShowReviewsList({ showId, className }: { showId: string; className?: string }) {
  const reviews = useReviews()
  const list = useMemo(() => reviewsForShow(showId, reviews), [showId, reviews])
  const average = useMemo(() => averageRating(showId, reviews), [showId, reviews])

  if (list.length === 0) {
    return (
      <p className={cn("rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground", className)}>
        لا تقييمات بعد لهذا العرض — كن أول من يحضره ويشارك تجربته 🎭
      </p>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
        <span className="font-serif text-2xl font-bold text-amber-300">{average.toFixed(1)}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              className={cn(
                "h-4 w-4",
                value <= Math.round(average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">من {list.length} تقييم موثق</span>
      </div>

      {list.map((review) => (
        <article key={review.id} className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{review.userName}</span>
              {review.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  <BadgeCheck className="h-3 w-3" />
                  {VERIFIED_BADGE_LABEL}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  className={cn(
                    "h-3.5 w-3.5",
                    value <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                  )}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            تذكرة الحضور: <span className="font-mono" dir="ltr">{review.ticketId}</span> ·{" "}
            {new Date(review.createdAt).toLocaleDateString("ar-EG")}
          </p>
        </article>
      ))}
    </div>
  )
}
