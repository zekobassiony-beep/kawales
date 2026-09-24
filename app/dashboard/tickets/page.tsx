import { getEvents, getVenues } from "@/lib/queries"
import { TicketPassConsole } from "@/app/dashboard/tickets/ticket-pass-console"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "حجوزاتي وتذاكري — كواليس",
  description: "تذاكرك الرقمية: اعرض رمز QR، حمّل التذكرة، أهدها لصديق، وافتح لوكيشن المسرح.",
  robots: { index: false, follow: false },
}

/**
 * صفحة «حجوزاتي وتذاكري» للعميل (`/dashboard/tickets`):
 * تُبنى روابط خرائط المسارح من قاعدة البيانات (google_maps_url) وتُمرَّر للواجهة.
 */
export default async function MyTicketsPage() {
  const [venues, events] = await Promise.all([getVenues(), getEvents()])

  // خريطة: اسم المسرح → رابط Google Maps (من الجدول أو من الشِّعار التلقائي).
  const mapsByVenue: Record<string, string> = {}
  for (const venue of venues) {
    if (venue.googleMapsUrl) mapsByVenue[venue.name] = venue.googleMapsUrl
  }
  for (const event of events) {
    if (event.venue.googleMapsUrl && !mapsByVenue[event.venue.name]) {
      mapsByVenue[event.venue.name] = event.venue.googleMapsUrl
    }
  }

  return <TicketPassConsole mapsByVenue={mapsByVenue} />
}
