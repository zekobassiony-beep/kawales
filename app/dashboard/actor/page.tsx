import { mockAuditions } from "@/lib/dashboards"
import { ActorDashboardContent } from "@/app/dashboard/actor/actor-dashboard-content"
import { CustomerZone } from "@/app/dashboard/customer/customer-zone"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "لوحة الممثل — كواليس",
  description: "الملف الشخصي للممثل وتصفح الأودشنات وتلقائي دعوات الفرق وأرشيف الأعمال.",
}

/** Server Component: يجلب بيانات البدء ويمررها إلى العميل الذي يدير التفاعلات. */
export default function ActorDashboardPage() {
  return (
    <>
      {/* منطقة التذاكر أول الصفحة لكل الفئات. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <CustomerZone />
      </div>

      <ActorDashboardContent initialAuditions={mockAuditions} />
    </>
  )
}
