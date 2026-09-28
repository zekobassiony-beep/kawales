import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * اختصار `/gatekeeper` — يحوّل إلى بوابة المسرح `/dashboard/venue/checkin`
 * (مسح تذاكر الجمهور وتسجيل الحضور). محميّ بنفس بوابة الأدمن في `middleware.ts`.
 */
export default function GatekeeperShortcutPage() {
  redirect("/dashboard/venue/checkin")
}
