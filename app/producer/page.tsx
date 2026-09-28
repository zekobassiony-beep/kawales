import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * اختصار `/producer` — يحوّل إلى لوحة المخرج/منظّم العروض `/dashboard/producer`.
 * الوسيط (`middleware.ts`) يتحقق من الجلسة وصلاحية الأدمن قبل الوصول هنا.
 */
export default function ProducerShortcutPage() {
  redirect("/dashboard/producer")
}
