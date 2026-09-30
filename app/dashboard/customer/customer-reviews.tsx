"use client"

import { useMemo } from "react"
import Link from "next/link"
import { MessageSquare, Star, Sparkles, Ticket, Calendar, Award } from "lucide-react"
import { useReviews, VERIFIED_BADGE_LABEL } from "@/lib/reviews"
import { useSession } from "@/lib/session"
import { useTickets, getTicketsForUser } from "@/lib/tickets"

export function CustomerReviews() {
  const session = useSession()
  const allReviews = useReviews()
  const tickets = useTickets()
  const viewerEmail = (session?.email ?? "").trim().toLowerCase()
  const viewerName = (session?.profile?.fullName || session?.name || "").trim().toLowerCase()

  // جلب التقييمات الخاصة بالمستخدم الحالي إما بالبريد أو بالاسم
  const myReviews = useMemo(() => {
    if (!viewerEmail && !viewerName) return []
    return allReviews.filter((rev) => {
      const matchEmail = viewerEmail.length > 0 && rev.userId.trim().toLowerCase() === viewerEmail
      const matchName = viewerName.length > 0 && rev.userName.trim().toLowerCase() === viewerName
      return matchEmail || matchName
    })
  }, [allReviews, viewerEmail, viewerName])

  // خريطة لتحديد عنوان العرض من التذاكر المحفوظة إن أمكن
  const userTickets = useMemo(() => getTicketsForUser(viewerEmail), [tickets, viewerEmail])
  const ticketShowMap = useMemo(() => {
    const map = new Map<string, string>()
    userTickets.forEach((t) => {
      map.set(t.id, t.showTitle)
      map.set(t.showId, t.showTitle)
    })
    return map
  }, [userTickets])

  if (myReviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center sm:p-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h3 className="mt-4 font-serif text-lg font-semibold">لم تترك أي تعليقات أو تقييمات بعد</h3>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          نظام التقييمات في كواليس موثّق بالكامل: بعد حضورك العرض ومسح تذكرتك عند بوابة المسرح، ستتمكن من تقييم العرض ومشاركة انطباعك مع الجمهور وصنّاع المسرح.
        </p>
        <Link
          href="/shows"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <Ticket className="h-4 w-4 text-primary" />
          تصفح العروض واحجز تذكرتك
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          لديك <span className="font-semibold text-foreground">{myReviews.length}</span> تقييم موثق منشور
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {myReviews.map((review) => {
          const showTitle = ticketShowMap.get(review.ticketId) || ticketShowMap.get(review.showId) || `عرض مسرحي #${review.showId}`
          const dateStr = new Date(review.createdAt).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })

          return (
            <article
              key={review.id}
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-serif text-base font-bold text-foreground">{showTitle}</h4>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {dateStr}
                    </p>
                  </div>

                  {/* تقييم النجوم */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold">{review.rating}</span>
                    <span className="text-[10px] text-amber-200/70">/ 5</span>
                  </div>
                </div>

                {/* نص التعليق */}
                <div className="mt-4 rounded-xl border border-border/40 bg-background/50 p-3.5">
                  <p className="text-xs leading-relaxed text-zinc-200">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-[11px]">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Award className="h-3.5 w-3.5" />
                  {VERIFIED_BADGE_LABEL}
                </span>

                <span className="font-mono text-muted-foreground" dir="ltr">
                  كود التذكرة: {review.ticketId}
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
