import Link from "next/link"
import Image from "next/image"
import { CalendarDays, MapPin } from "lucide-react"
import type { EventWithRelations } from "@/lib/queries"
import { formatDate, formatPrice } from "@/lib/format"

export function ShowCard({ event }: { event: EventWithRelations }) {
  const minPrice = Math.min(...event.priceTiers.map((t) => t.priceCents))

  return (
    <Link
      href={`/shows/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={event.posterUrl ?? "/placeholder.svg"}
          alt={`ملصق عرض ${event.title}`}
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {event.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {event.troupe.name}
        </p>
        <h3 className="mt-1 font-serif text-lg font-semibold leading-tight text-balance">
          {event.title}
        </h3>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatDate(event.startsAt)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {event.venue.name}، {event.venue.city}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-sm text-muted-foreground">
            تبدأ من{" "}
            <span className="font-semibold text-foreground">
              {formatPrice(minPrice)}
            </span>
          </span>
          <span className="text-sm font-medium text-primary transition-transform group-hover:-translate-x-0.5">
            احجز الآن
          </span>
        </div>
      </div>
    </Link>
  )
}
