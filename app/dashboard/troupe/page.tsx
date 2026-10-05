import { getDefaultTroupe, getTroupeShows, getTroupeWallet } from "@/lib/dashboards"
import { getEvents } from "@/lib/queries"
import { TroupeDashboardClient } from "@/app/dashboard/troupe/troupe-dashboard-client"
import { CustomerZone } from "@/app/dashboard/customer/customer-zone"
import { WorkspaceSetupBanner } from "@/components/workspace-setup-banner"
import { loadMyProfile } from "@/app/actions/profile"

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
  const [wallet, shows, allEvents, profile] = await Promise.all([
    getTroupeWallet(troupeId),
    getTroupeShows(troupeId),
    getEvents(),
    loadMyProfile(),
  ])

  const venueOptions = Array.from(
    new Set(allEvents.map((event) => event.venue?.name).filter((venue): venue is string => Boolean(venue))),
  ).sort()

  /**
   * اسم الفرقة المعروض بعد «لوحة التحكم»:
   *  1) الاسم الذي كتبه صاحب الحساب في `/onboarding` (ملف المستخدم في قاعدة البيانات).
   *  2) وإلا اسم الفرقة المرتبطة من قاعدة البيانات.
   */
  const profileTroupeName = profile.ok ? (profile.profile?.profile?.troupeName ?? "").trim() : ""
  const troupeName = profileTroupeName.length > 0 ? profileTroupeName : (troupe?.name ?? "")

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-8 sm:px-6">
        <WorkspaceSetupBanner />
        {/* منطقة التذاكر أول الصفحة: الأرقام التحليلية والتذاكر قبل محتوى الفرقة. */}
        <CustomerZone />
      </div>

      <TroupeDashboardClient
        troupe={troupe ? { name: troupe.name, city: troupe.city } : null}
        troupeName={troupeName}
        wallet={wallet}
        shows={shows}
        venueOptions={venueOptions}
      />
    </>
  )
}
