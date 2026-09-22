import { getDefaultTroupe, getTroupeShows, getTroupeWallet } from "@/lib/dashboards"
import { getEvents } from "@/lib/queries"
import { TroupeDashboardClient } from "@/app/dashboard/troupe/troupe-dashboard-client"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة الفرقة — كواليس",
  description: "محفظة الفرقة وإدارة العروض والأودشنات وماسح تذاكر البوابة.",
}

/**
 * Server Component: يجلب محفظة الفرقة وعروضها من قاعدة البيانات ثم يمرّرها
 * جاهزة إلى مكوّن العميل `TroupeDashboardClient` الذي يحمل الواجهة والتفاعلات.
 */
export default async function TroupeDashboardPage() {
  const troupe = await getDefaultTroupe()
  const troupeId = troupe?.id ?? 0
  const [wallet, shows, allEvents] = await Promise.all([getTroupeWallet(troupeId), getTroupeShows(troupeId), getEvents()])

  const venueOptions = Array.from(
    new Set(allEvents.map((event) => event.venue?.name).filter((venue): venue is string => Boolean(venue))),
  ).sort()

  return (
    <TroupeDashboardClient
      troupe={troupe ? { name: troupe.name, city: troupe.city } : null}
      wallet={wallet}
      shows={shows}
      venueOptions={venueOptions}
    />
  )
}
