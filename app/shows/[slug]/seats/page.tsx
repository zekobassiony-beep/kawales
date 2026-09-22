import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * توحيد مسار الحجز: مسار اختيار المقاعد القديم يُعاد توجيهه إلى مسار
 * «الحجز والدفع المباشر» الموحّد `/shows/[slug]/book`.
 */
export default async function SeatSelectionRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/shows/${slug}/book`)
}
