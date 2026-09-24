import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** مسار مختصر `/my-tickets` — يُحوّل إلى صفحة «حجوزاتي وتذاكري». */
export default function MyTicketsShortcutPage() {
  redirect("/dashboard/tickets")
}
