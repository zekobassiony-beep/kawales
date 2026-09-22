import { getCategories, getEvents, getTroupes } from "@/lib/queries"
import { SiteHeaderClient, type SiteHeaderNavData } from "@/components/site-header-client"

/** أقصى عدد عناصر يُعرض في كل قسم من أقسام القائمة الجانبية. */
const NAV_LIMIT = 5

/**
 * الهيدر العام: يجمع أسماء الفئات والفرق والمسارح على السيرفر ثم يمرّرها إلى
 * `SiteHeaderClient` الذي يحمل فتح/إغلاق القائمة الجانبية وحالة الحساب.
 *
 * لا يوجد عمود تقييم في مخطط قاعدة البيانات بعد، لذا يُرتَّب «الأفضل» حسب عدد
 * العروض المجدولة لكل فرقة/مسرح — ويكفي لاحقًا تغيير المُقارِن عند إضافة التقييم.
 */
export async function SiteHeader() {
  const [categories, troupes, events] = await Promise.all([getCategories(), getTroupes(), getEvents()])

  const troupeShowCounts = new Map<string, number>()
  const venues = new Map<number, { name: string; city: string; showsCount: number }>()

  for (const event of events) {
    troupeShowCounts.set(event.troupe.name, (troupeShowCounts.get(event.troupe.name) ?? 0) + 1)
    const venue = venues.get(event.venue.id)
    if (venue) venue.showsCount += 1
    else venues.set(event.venue.id, { name: event.venue.name, city: event.venue.city, showsCount: 1 })
  }

  const nav: SiteHeaderNavData = {
    categories,
    troupes: [...troupes]
      .sort(
        (a, b) =>
          (troupeShowCounts.get(b.name) ?? 0) - (troupeShowCounts.get(a.name) ?? 0) ||
          a.name.localeCompare(b.name, "ar"),
      )
      .slice(0, NAV_LIMIT)
      .map((troupe) => ({
        name: troupe.name,
        city: troupe.city,
        showsCount: troupeShowCounts.get(troupe.name) ?? 0,
      })),
    venues: [...venues.values()]
      .sort((a, b) => b.showsCount - a.showsCount || a.name.localeCompare(b.name, "ar"))
      .slice(0, NAV_LIMIT),
  }

  return <SiteHeaderClient nav={nav} />
}
