import { OnboardingForm } from "@/app/onboarding/onboarding-form"

// الهيدر (في الـ Layout) يقرأ الفئات والفرق والمسارح، لذا نُصيّر الصفحة لكل طلب.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "إكمال البيانات — كواليس",
  description: "أكمل ملفك حسب فئتك: عميل، فنان، فرقة، أو مدير مسرح، ثم انتقل إلى لوحتك.",
}

/**
 * صفحة إكمال التأهيل والبيانات: تقرأ الفئة المحفوظة في الجلسة (`lib/session.ts`)
 * وتعرض الحقول المناسبة لها، ثم تحفظ البروفايل وتُوجّه للوحة الفئة.
 */
export default function OnboardingPage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(245,196,81,0.08),transparent_60%)]"
      />
      <OnboardingForm />
    </div>
  )
}
