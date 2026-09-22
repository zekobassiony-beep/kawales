import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, CalendarDays, MapPin } from "lucide-react"
import { getEventBySlug } from "@/lib/queries"
import { bookingBlockedReason } from "@/lib/booking-rules"
import { formatDate } from "@/lib/format"
import { CheckoutWizard } from "@/components/checkout-wizard"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: "العرض غير موجود — كواليس" }
  return {
    title: `احجز تذكرتك — ${event.title} — كواليس`,
    description: `رحلة الحجز والدفع المباشر لعرض ${event.title} في ${event.venue.name}.`,
  }
}

/**
 * صفحة رحلة الحجز والدفع المباشر:
 * اختيار المقاعد/الفئات ثم الدفع عبر فودافون كاش أو InstaPay واستلام التذكرة فورًا.
 */
export default async function BookShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const blocked = bookingBlockedReason(event)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href={`/shows/${event.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى العرض
      </Link>

      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">{event.troupe.name}</p>
        <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">احجز تذكرتك</h1>
        <p className="mt-2 text-muted-foreground">{event.title}</p>
      </header>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-border/60 bg-card p-5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {formatDate(event.startsAt)}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {event.venue.name}، {event.venue.city}
        </span>
      </div>

      <div className="mt-8">
        {blocked ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
            <p className="font-medium">الحجز مغلق لهذا العرض</p>
            <p className="mt-1 text-amber-200/80">{blocked}</p>
          </div>
        ) : (
          <CheckoutWizard event={event} mode="numbered" />
        )}
      </div>
    </div>
  )
}
