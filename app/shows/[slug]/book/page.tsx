import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * إلغاء مسار الدفع القديم متعدد الخطوات: يُعاد توجيه الحجز إلى صفحة العرض
 * الموحّدة التي تحتوي خريطة الكراسي/كارت الفئات ونافذة الدفع الموحّدة.
 */
export default async function BookShowRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/shows/${slug}`)
}
