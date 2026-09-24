import Image from "next/image"
import Link from "next/link"
import { CalendarDays, Clock, MapPin, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventWithRelations } from "@/lib/queries"
import { formatDate, formatPrice, formatTime } from "@/lib/format"
import { occupancyInfo } from "@/lib/show-detail"
import { ShowRatingStats } from "@/app/shows/[slug]/show-reviews-panel"

/**
 * كارت عرض في الشاشة الرئيسية — Dark Graphite & Gold:
 * شريط نسبة الإشغال + شارات الحالة (رائج/أماكن محدودة/مباع) + بيانات العرض وزر القرار.
 */
export function ShowCard({
  event,
  sold = 0,
  capacity,
}: {
  event: EventWithRelations
  /** المقاعد المباعة (من قاعدة البيانات) لحساب الإشغال. */
  sold?: number
  /** سعة المسرح — تُحسب من صفوفه ومقاعده إن لم تُمرَّر. */
  capacity?: number
}) {
  const minPrice = Math.min(...event.priceTiers.map((tier) => tier.priceCents))
  const totalCapacity = capacity ?? Math.max(1, event.venue.rows * event.venue.seatsPerRow)
  const occupancy = occupancyInfo(sold, totalCapacity)
  const soldOut = occupancy.remaining === 0
  const blocked = event.status !== "on_sale"
  const tags = [event.category, event.language].filter((tag) => tag.trim().length > 0)

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-all hover:border-amber-500/40 hover:shadow-[0_0_40px_-18px_rgba(245,158,11,0.9)]">
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={event.posterUrl ?? "/placeholder.svg"}
          alt={`ملصق عرض ${event.title}`}
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-900 to-transparent" />

        <span className="absolute right-3 top-3 rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur">
          {event.category}
        </span>
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur",
            soldOut
              ? "border-red-500/50 bg-red-500/20 text-red-200"
              : occupancy.status === "limited"
                ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                : "border-emerald-500/50 bg-emerald-500/20 text-emerald-200",
          )}
        >
          {soldOut ? "مباع" : occupancy.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400">{event.troupe.name}</p>
        <h3 className="mt-1 font-serif text-lg font-semibold leading-tight text-zinc-50">{event.title}</h3>

        <div className="mt-2">
          <ShowRatingStats showId={String(event.id)} className="text-[10px]" />
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-zinc-400">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            {formatDate(event.startsAt)}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            {formatTime(event.startsAt)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            {event.venue.name}، {event.venue.city}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[10px] text-zinc-400">
              {tag}
            </span>
          ))}
        </div>

        {/* شريط نسبة الإشغال */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className={soldOut ? "font-semibold text-red-400" : "text-zinc-400"}>
              {soldOut ? "نفدت التذاكر" : `${occupancy.remaining} مقعد متبقي`}
            </span>
            <span className="font-mono text-zinc-500">{occupancy.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className={cn("h-full rounded-full transition-all", occupancy.barClass)} style={{ width: `${occupancy.pct}%` }} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
          <span className="text-xs text-zinc-400">
            تبدأ من <span className="font-semibold text-amber-400">{formatPrice(minPrice)}</span>
          </span>
          {soldOut || blocked ? (
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-500">
              <Ticket className="h-3.5 w-3.5" />
              {soldOut ? "مباع" : "غير متاح"}
            </span>
          ) : (
            <Link
              href={`/shows/${event.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-[11px] font-bold text-zinc-950 transition-colors hover:bg-amber-400"
            >
              <Ticket className="h-3.5 w-3.5" />
              احجز الآن
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
