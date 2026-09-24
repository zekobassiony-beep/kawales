import Link from "next/link"
import { CalendarDays, ExternalLink, MapPin, Sparkles, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, formatTime } from "@/lib/format"
import type { ShowtimeCard } from "@/lib/show-detail"

/** تبويب «التفاصيل»: قصة العرض · مواعيد أفقية · موقع المسرح · خصم الشلة. */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

export function ShowDetailsPanel({
  description,
  troupeName,
  troupeBio,
  showtimes,
  venue,
  mapsUrl,
  minPriceCents,
  groupDiscountEnabled = false,
}: {
  description: string
  troupeName: string
  troupeBio: string
  showtimes: ShowtimeCard[]
  venue: { name: string; address: string; city: string }
  mapsUrl: string
  minPriceCents: number
  groupDiscountEnabled?: boolean
}) {
  return (
    <div className="space-y-6">
      <section className={cn(CARD, "p-6")}>
        <h2 className="font-serif text-xl font-semibold text-zinc-100">قصة العرض</h2>
        <p className="mt-3 leading-relaxed text-zinc-300">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          إنتاج {troupeName} — {troupeBio}
        </p>
      </section>

      <section className={cn(CARD, "p-6")}>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
          <CalendarDays className="h-5 w-5 text-amber-400" />
          مواعيد العرض
        </h2>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {showtimes.map((showtime) => (
            <Link
              key={showtime.id}
              href={`/shows/${showtime.slug}`}
              className={cn(
                "min-w-[168px] shrink-0 rounded-2xl border p-4 text-center transition-all",
                showtime.isCurrent
                  ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_30px_-14px_rgba(245,158,11,0.95)]"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700",
                showtime.status === "sold_out" && "opacity-70",
              )}
            >
              <p className="text-xs text-zinc-400">{showtime.dateLabel}</p>
              <p className="mt-1 font-serif text-lg font-bold text-zinc-100">{showtime.timeLabel}</p>
              <span
                className={cn(
                  "mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                  showtime.status === "available"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300",
                )}
              >
                {showtime.statusLabel}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={cn(CARD, "p-6")}>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
          <MapPin className="h-5 w-5 text-amber-400" />
          موقع المسرح
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{venue.name}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {venue.address} — {venue.city}
            </p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 shadow-[0_0_30px_-10px_rgba(245,158,11,0.95)] transition-colors hover:bg-amber-400"
          >
            <ExternalLink className="h-4 w-4" />
            افتح في خريطة ↗
          </a>
        </div>
      </section>

      {groupDiscountEnabled && (
        <section className={cn(CARD, "flex flex-wrap items-center justify-between gap-4 border-emerald-500/30 p-6")}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                <Users className="h-3.5 w-3.5" />
                تذكرة الشلة — خصم 15%
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                عند حجز 5 تذاكر أو أكثر في نفس الطلب. تبدأ التذاكر من {formatPrice(minPriceCents)}.
              </p>
            </div>
          </div>
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
            يظهر الخصم تلقائيًا في صندوق الحجز
          </p>
        </section>
      )}

      <p className="text-[11px] text-zinc-500">مدة العرض محسوبة على موعد {formatTime(new Date())} بتوقيت القاهرة.</p>
    </div>
  )
}
