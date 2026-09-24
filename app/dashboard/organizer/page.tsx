import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** مسار مختصر `/dashboard/organizer` — يُحوّل إلى لوحة المخرج `/dashboard/producer`. */
export default function OrganizerShortcutPage() {
  redirect("/dashboard/producer")
}
