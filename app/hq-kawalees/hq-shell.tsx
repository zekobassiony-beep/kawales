"use client"

import { useSession } from "@/lib/session"
import { isSuperadmin } from "@/lib/roles"
import { HqDashboard } from "@/app/hq-kawalees/hq-dashboard-client"

/**
 * غلاف العميل لغرفة العمليات: يقرأ الجلسة المحلية ويمرّر اسم الأدمن.
 * الحماية الفعلية وقعت مسبقًا في `HqGate` (تحويل الزوار العاديين للرئيسية).
 */
export function HqShell() {
  const session = useSession()
  const adminName = isSuperadmin(session?.email) ? session?.name ?? "فريق كواليس" : "فريق كواليس"

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <HqDashboard adminName={adminName} />
    </div>
  )
}
