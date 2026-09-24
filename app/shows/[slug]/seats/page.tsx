import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * إلغاء مسار اختيار المقاعد القديم: يُعاد توجيهه إلى صفحة العرض الموحّدة
 * (خريطة الكراسي التفاعلية مدمجة هناك مع نافذة الدفع الموحّدة).
 */
export default async function SeatSelectionRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/shows/${slug}`)
}
