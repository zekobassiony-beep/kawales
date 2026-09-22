"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, MapPin, ChevronLeft, ChevronRight } from "lucide-react"
import type { EventWithRelations } from "@/lib/queries"
import { formatDate, formatPrice } from "@/lib/format"

export function HeroCarousel({ events }: { events: EventWithRelations[] }) {
  const [index, setIndex] = useState(0)
  const count = events.length

  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count],
  )

  useEffect(() => {
    if (count <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000)
    return () => clearInterval(timer)
  }, [count])

  if (count === 0) return null

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      {events.map((event, i) => {
        const minPrice = Math.min(...event.priceTiers.map((t) => t.priceCents))
        return (
          <div
            key={event.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
            aria-hidden={i !== index}
          >
            <Image
              src={event.heroUrl ?? event.posterUrl ?? "/placeholder.svg"}
              alt={`مشهد من عرض ${event.title}`}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

            <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-4 sm:px-6">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary">
                  التذاكر متاحة الآن · {event.category}
                </span>
                <p className="mt-5 text-sm font-medium uppercase tracking-wide text-primary">
                  {event.troupe.name}
                </p>
                <h1 className="mt-2 font-serif text-4xl font-bold leading-[1.05] text-balance sm:text-6xl">
                  {event.title}
                </h1>
                <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground text-pretty">
                  {event.tagline}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatDate(event.startsAt)}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {event.venue.name}, {event.venue.city}
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/shows/${event.slug}`}
                    className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    احجز تذكرتك
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    تبدأ من{" "}
                    <span className="font-semibold text-foreground">
                      {formatPrice(minPrice)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="العرض السابق"
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border/60 bg-background/60 p-2.5 text-foreground backdrop-blur transition-colors hover:bg-background md:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="العرض التالي"
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border/60 bg-background/60 p-2.5 text-foreground backdrop-blur transition-colors hover:bg-background md:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {events.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`انتقل إلى الشريحة ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-primary" : "w-2.5 bg-foreground/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
