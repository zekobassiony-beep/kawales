import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CustomerZone } from "@/app/dashboard/customer/customer-zone"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة العميل — كواليس",
  description: "تذاكرك وحجوزاتك وربط حسابك بتليجرام في كواليس.",
}

/**
 * لوحة العميل: تعرض «منطقة العميل» المشتركة (`CustomerZone`) التي تُضاف أيضًا
 * إلى كل لوحات الفئات الأخرى، فتبقى القراءة من مصدر واحد.
 */
export default function CustomerDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى العروض
      </Link>

      <CustomerZone />
    </div>
  )
}
