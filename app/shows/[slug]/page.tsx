import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { CalendarDays, Clock, MapPin, Languages, ArrowRight, Ticket } from "lucide-react"
import { getEventBySlug } from "@/lib/queries"
import { formatDate, formatTime, formatDuration, formatPrice } from "@/lib/format"
import { bookingBlockedReason } from "@/lib/booking-rules"
import { ShowReviewsList, VerifiedReviewForm } from "@/components/verified-review-form"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: "العرض غير موجود — كواليس" }
  return {
    title: `${event.title} — كواليس`,
    description: event.tagline,
  }
}

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const minPrice = Math.min(...event.priceTiers.map((t) => t.priceCents))
  const blocked = bookingBlockedReason(event)

  return (
    <div>
      {/* Hero */}
      <div className="relative h-[46vh] min-h-[340px] w-full overflow-hidden">
        <Image
          src={event.heroUrl ?? event.posterUrl ?? "/placeholder.svg"}
          alt={`${event.title} stage scene`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
            <Link
              href="/shows"
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowRight className="h-4 w-4" />
              كل العروض
            </Link>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              {event.troupe.name}
            </p>
            <h1 className="mt-1 font-serif text-4xl font-bold leading-tight sm:text-5xl text-balance">
              {event.title}
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground text-pretty">
              {event.tagline}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Main */}
          <div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-xl border border-border/60 bg-card p-6">
              <Fact icon={CalendarDays} label="التاريخ" value={formatDate(event.startsAt)} />
              <Fact icon={Clock} label="موعد العرض" value={formatTime(event.startsAt)} />
              <Fact icon={Clock} label="مدة العرض" value={formatDuration(event.durationMinutes)} />
              <Fact icon={Languages} label="اللغة" value={event.language} />
            </div>

            <section className="mt-10">
              <h2 className="font-serif text-2xl font-semibold">عن العرض</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl font-semibold">المسرح</h2>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-border/60 bg-card p-5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{event.venue.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.venue.address}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.venue.city}</p>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl font-semibold">
                عن فرقة {event.troupe.name}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {event.troupe.bio}
              </p>
            </section>
          </div>

          {/* Booking sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="relative aspect-[3/4] w-full">
                <Image
                  src={event.posterUrl ?? "/placeholder.svg"}
                  alt={`ملصق عرض ${event.title}`}
                  fill
                  sizes="360px"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground">
                  تبدأ التذاكر من{" "}
                  <span className="text-lg font-semibold text-foreground">
                    {formatPrice(minPrice)}
                  </span>
                </p>

                <ul className="mt-4 space-y-2">
                  {event.priceTiers.map((tier) => (
                    <li
                      key={tier.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tier.color }}
                        />
                        {tier.name}
                      </span>
                      <span className="font-medium">
                        {formatPrice(tier.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>

                {blocked ? (
                  <p className="mt-6 rounded-full border border-border/60 bg-secondary/40 px-6 py-3 text-center text-sm text-muted-foreground">
                    {blocked}
                  </p>
                ) : (
                  <>
                    <Link
                      href={`/shows/${event.slug}/book`}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Ticket className="h-4 w-4" />
                      الحجز والدفع المباشر
                    </Link>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      اختر مقعدك أو فئتك ثم ادفع بفودافون كاش أو انستا باي · تذكرة رقمية فورية برمز QR
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* التقييمات الموثقة (Verified Reviews) */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-2xl font-bold">تقييمات الجمهور</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            كل تقييم هنا موثق بتذكرة سُجّل حضورها عند بوابة المسرح — شفافية كاملة بلا تقييمات وهمية.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
            <ShowReviewsList showId={String(event.id)} />
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <VerifiedReviewForm showId={String(event.id)} showTitle={event.title} />
              <div className="rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">كيف يُوثَّق التقييم؟</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>احجز تذكرتك بفودافون كاش أو انستا باي واعتمد التحويل عبر بوت كواليس.</li>
                  <li>امسح رمز QR عند بوابة المسرح ليُسجَّل حضورك.</li>
                  <li>يظهر لك نموذج التقييم بالنجوم مباشرة بعد الحضور.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
