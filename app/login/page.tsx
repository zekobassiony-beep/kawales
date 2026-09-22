import { RoleGate } from "@/app/login/role-gate"

// الهيدر (في الـ Layout) يقرأ الفئات والفرق والمسارح، لذا نُصيّر الصفحة لكل طلب.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "الدخول واختيار الشخصية — كواليس",
  description:
    "اختر فئتك في كواليس: عميل مسرحي، فنان/ممثل، مخرج/فرقة، أو مدير مسرح، واحصل على لوحتك الخاصة.",
}

/**
 * بوابة الدخول: واجهة كاملة الشاشة بأربع بطاقات (شخصيات) تتوسّع عند الوقوف أو
 * التحديد، ونموذج الدخول في مودال، ثم التوجيه إلى `/onboarding`.
 */
export default function LoginPage() {
  return <RoleGate />
}
