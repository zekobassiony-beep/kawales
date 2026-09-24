import { getEvents, getSoldSeatCounts } from "@/lib/queries"
import { ProducerConsole } from "@/app/dashboard/producer/producer-console"
import type { ProducerEventInput } from "@/lib/producer-metrics"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة المخرج ومنظم العروض — كواليس",
  description: "مبيعات العروض، نسب الإشغال، مراجعة إيصالات التحويل، وطلبات الكاستينج في مكان واحد.",
  robots: { index: false, follow: false },
}

/**
 * لوحة المخرج/منظم العروض (`/dashboard/producer`):
 * تجلب العروض الحقيقية من قاعدة البيانات (مع عدد المقاعد المباعة) وتمرّرها
 * للواجهة التفاعلية التي تعرض المؤشرات والمخطط والإيصالات والكاستينج.
 */
export default async function ProducerDashboardPage() {
  const events = await getEvents()
  const soldCounts = await getSoldSeatCounts(events.map((event) => event.id))

  const producerEvents: ProducerEventInput[] = events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    startsAtIso: event.startsAt.toISOString(),
    venueName: event.venue.name,
    venueCity: event.venue.city,
    capacity: Math.max(1, event.venue.rows * event.venue.seatsPerRow),
  }))

  return (
    <div className="min-h-screen bg-zinc-950">
      <ProducerConsole events={producerEvents} />
    </div>
  )
}
