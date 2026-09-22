import { mockAuditions } from "@/lib/dashboards"
import { ActorDashboardContent } from "@/app/dashboard/actor/actor-dashboard-content"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "لوحة الممثل — كواليس",
  description: "الملف الشخصي للممثل وتصفح الأودشنات وتلقائي دعوات الفرق وأرشيف الأعمال.",
}

/** Server Component: يجلب بيانات البدء ويمررها إلى العميل الذي يدير التفاعلات. */
export default function ActorDashboardPage() {
  return <ActorDashboardContent initialAuditions={mockAuditions} />
}
