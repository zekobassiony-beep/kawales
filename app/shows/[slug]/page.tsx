import Image from "next/image"
import { notFound } from "next/navigation"
import { CalendarDays, Languages, MapPin, Play, Star, Users } from "lucide-react"
import { getEventBySlug, getEvents, getSoldSeatCounts } from "@/lib/queries"
import { formatDate, formatDuration, formatTime } from "@/lib/format"
import { bookingBlockedReason } from "@/lib/booking-rules"
import { cn } from "@/lib/utils"
import { ageRatingFor, buildShowtimeCards, mapsUrlFor, occupancyInfo } from "@/lib/show-detail"
import { ShowTabs, ShowCastPanel } from "@/app/shows/[slug]/show-tabs"
import { ShowRatingStats, ShowReviewsPanel } from "@/app/shows/[slug]/show-reviews-panel"
import { ShowDetailsPanel } from "@/app/shows/[slug]/show-details-panel"
import { ShowBookingBox } from "@/app/shows/[slug]/show-booking-box"
import { ShowSidebarExtras } from "@/app/shows/[slug]/show-booking-parts"

export const dynamic = "force-dynamic"

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: "العرض غير موجود — كواليس" }
  return { title: `${event.title} — كواليس`, description: event.tagline }
}

export default async function ShowDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  // العروض الأخرى لنفس الفرقة تُستخدم كمواعيد إضافية، ونحسب الإشغال الفعلي.
  const allEvents = await getEvents()
  const troupeEvents = allEvents.filter((item) => item.troupe.id === event.troupe.id)
  const soldCounts = await getSoldSeatCounts([...new Set([event.id, ...troupeEvents.map((item) => item.id)])])

  const capacity = Math.max(1, event.venue.rows * event.venue.seatsPerRow)
  const sold = soldCounts.get(event.id) ?? 0
  const minPrice = Math.min(...event.priceTiers.map((tier) => tier.priceCents), 0)
  const occupancy = occupancyInfo(sold, capacity)
  const blocked = bookingBlockedReason(event)
  const ageRating = ageRatingFor({ category: event.category, durationMinutes: event.durationMinutes })
  const mapsUrl = mapsUrlFor(event.venue)

  const showtimes = buildShowtimeCards(
    troupeEvents.map((item) => ({
      id: item.id,
      slug: item.slug,
      startsAt: item.startsAt,
      sold: soldCounts.get(item.id) ?? 0,
      capacity: Math.max(1, item.venue.rows * item.venue.seatsPerRow),
    })),
    event.id,
    formatDate,
    formatTime,
  )

  const tags = [event.category, "مسرح", event.language].filter((tag) => tag.trim().length > 0)
  const organizer = { phone: event.troupe.city ? "+201000000000" : "+201000000000", email: `${event.troupe.slug}@kawalees.test` }

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="relative min-h-[420px] w-full overflow-hidden">
        <Image
          src={event.heroUrl ?? event.posterUrl ?? "/placeholder.svg"}
          alt={`مشهد من عرض ${event.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />

        <button
          type="button"
          aria-label="تشغيل التريلر"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/50 bg-zinc-950/70 text-amber-400 shadow-[0_0_40px_-10px_rgba(245,158,11,0.95)] backdrop-blur transition-transform hover:scale-105"
        >
          <Play className="h-6 w-6" />
        </button>

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-24 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">{event.troupe.name}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-zinc-50 sm:text-5xl">{event.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">{event.tagline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-zinc-300">
                {tag}
              </span>
            ))}
            <ShowRatingStats showId={String(event.id)} />
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-zinc-300">
              ⏱ {formatDuration(event.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-semibold text-amber-300">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {ageRating}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* شبكة المعلومات السريعة (4 كروت) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={MapPin} label="المسرح" value={`${event.venue.name} — ${event.venue.city}`} />
          <InfoCard icon={CalendarDays} label="الموسم" value={formatDate(event.startsAt)} />
          <InfoCard icon={Users} label="الفرقة" value={event.troupe.name} />
          <InfoCard icon={Languages} label="اللغة" value={event.language} />
        </div>

        {/* تخطيط عمودين على الشاشات الكبيرة · عمود واحد على الموبايل
            (صندوق الحجز آخر عنصر في DOM ليظهر في نهاية الصفحة على الموبايل) */}
        <div className="mt-10 flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="min-w-0 space-y-10">
            <ShowTabs
              castCount={0}
              reviewCount={0}
              details={
                <ShowDetailsPanel
                  description={event.description}
                  troupeName={event.troupe.name}
                  troupeBio={event.troupe.bio}
                  showtimes={showtimes}
                  venue={event.venue}
                  mapsUrl={mapsUrl}
                  minPriceCents={minPrice}
                />
              }
              cast={<ShowCastPanel seed={event.title} />}
              reviews={<ShowReviewsPanel showId={String(event.id)} showTitle={event.title} />}
            />

            {/* خريطة المسرح (معاينة الإشغال) */}
            <section className={cn(CARD, "p-6")}>
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
                <MapPin className="h-5 w-5 text-amber-400" />
                خريطة المسرح
              </h2>
              <p className="mt-2 text-xs text-zinc-500">
                {event.venue.name} — {event.venue.rows} صفوف × {event.venue.seatsPerRow} مقعد ·{" "}
                <span className={occupancy.remaining === 0 ? "text-red-400" : "text-amber-300"}>
                  {occupancy.remaining} مقعد متبقٍ
                </span>
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                <SeatPreview rows={event.venue.rows} seatsPerRow={event.venue.seatsPerRow} sold={sold} />
              </div>
            </section>

            {/* التقييمات العامة (تحت الخريطة) */}
            <section className={cn(CARD, "p-6")}>
              <h2 className="font-serif text-xl font-semibold text-zinc-100">تقييمات الجمهور</h2>
              <p className="mt-2 text-xs text-zinc-500">
                كل تقييم هنا موثق بتذكرة سُجّل حضورها عند البوابة — بلا تقييمات وهمية.
              </p>
              <div className="mt-4">
                <ShowReviewsPanel showId={String(event.id)} showTitle={event.title} />
              </div>
            </section>
          </div>

          {/* صندوق الحجز (Sticky على الشاشات الكبيرة) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ShowBookingBox
              slug={event.slug}
              title={event.title}
              tiers={event.priceTiers}
              capacity={capacity}
              sold={sold}
              blockedReason={blocked}
            />
            <ShowSidebarExtras organizer={organizer} initialWaitlist={12} />
          </aside>
        </div>
      </div>
    </div>
  )
}

/** معاينة مبسطة لتخطيط الكراسي مع إظهار المباع/المتبقي تقريبيًا. */
function SeatPreview({ rows, seatsPerRow, sold }: { rows: number; seatsPerRow: number; sold: number }) {
  const total = Math.max(1, rows * seatsPerRow)
  const soldRatio = Math.min(1, sold / total)
  return (
    <div className="min-w-[520px] space-y-1.5" dir="ltr">
      <p className="mb-2 rounded-lg bg-amber-500/15 py-1 text-center text-[10px] font-semibold text-amber-300">المسرح / Stage</p>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-center gap-1">
          {Array.from({ length: seatsPerRow }, (_, seatIndex) => {
            const position = (rowIndex * seatsPerRow + seatIndex) / total
            const taken = position < soldRatio
            return (
              <span
                key={seatIndex}
                className={cn(
                  "h-4 w-4 rounded-[4px] border",
                  taken ? "border-red-500/50 bg-red-500/40" : "border-zinc-700 bg-zinc-800/70",
                )}
              />
            )
          })}
        </div>
      ))}
      <div className="mt-3 flex justify-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[4px] border border-zinc-700 bg-zinc-800/70" /> متاح
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[4px] border border-red-500/50 bg-red-500/40" /> مباع
        </span>
      </div>
    </div>
  )
}


function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className={`${CARD} p-4 transition-colors hover:border-amber-500/30`}>
      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  )
}
