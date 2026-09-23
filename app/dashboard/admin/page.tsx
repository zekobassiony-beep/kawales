import { checkAdminAccess, listAdminEmails } from "@/lib/auth"
import { getEvents } from "@/lib/queries"
import { AdminConsole } from "@/app/dashboard/admin/admin-console"
import { NoAccessPanel } from "@/app/dashboard/admin/no-access"
import type { HQEventInput } from "@/lib/hq-metrics"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة السوبر أدمن — كواليس",
  description: "إدارة المسؤولين، الحجوزات، وصلاحيات الدخول إلى لوحة التحكم العليا.",
  robots: { index: false, follow: false },
}

/**
 * لوحة السوبر أدمن (`/dashboard/admin`):
 *  - الوسيط `middleware.ts` يحمي المسار قبل الوصول (جلسة + كون البريد أدمن).
 *  - هذه الصفحة تُجري تحققًا ثانيًا على السيرفر بمفتاح الخدمة (طبقة حماية إضافية)
 *    وتُظهر شاشة 403 عند عدم الصلاحية.
 */
export default async function AdminDashboardPage() {
  const access = await checkAdminAccess()

  if (!access.allowed) {
    return <NoAccessPanel email={access.email} />
  }

  const list = await listAdminEmails()

  // بيانات العروض/المسارح/الفرق لمؤشرات ورسوم لوحة السوبر أدمن.
  const events = await getEvents()
  const hqEvents: HQEventInput[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    status: event.status,
    startsAtIso: event.startsAt.toISOString(),
    city: event.venue.city,
    venueName: event.venue.name,
    venueCapacity: Math.max(1, event.venue.rows * event.venue.seatsPerRow),
    minPriceCents: Math.min(...event.priceTiers.map((tier) => tier.priceCents), 0),
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <AdminConsole
        emails={list.emails}
        tableReady={list.tableReady}
        adminEmail={access.email}
        isMaster={access.master}
        events={hqEvents}
      />
    </div>
  )
}
