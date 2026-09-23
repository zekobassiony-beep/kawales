import { redirect } from "next/navigation"
import { ADMIN_DASHBOARD_PATH } from "@/lib/auth-constants"

export const dynamic = "force-dynamic"

/**
 * مسار مختصر `/admin` — يُحوّل إلى لوحة السوبر أدمن `/dashboard/admin`.
 * الوسيط (`middleware.ts`) يتحقق من الجلسة وصلاحية الأدمن قبل الوصول هنا.
 */
export default function AdminShortcutPage() {
  redirect(ADMIN_DASHBOARD_PATH)
}
