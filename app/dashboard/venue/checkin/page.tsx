import Link from "next/link"
import { ArrowRight, DoorOpen } from "lucide-react"
import { SectionTitle } from "@/app/dashboard/ui"
import { GateScanner } from "@/components/gate-scanner"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "بوابة المسرح — مسح التذاكر | كواليس",
  description: "واجهة فحص تذاكر كواليس عند بوابة المسرح: إدخال يدوي أو مسح QR مع تغذية بصرية وسمعية فورية.",
}

/**
 * صفحة بوابة المسرح (Gate Check-in):
 * يستعملها منظم البوابة لمسح تذاكر الجمهور وتسجيل الحضور — وهي الأساس الذي
 * يمنح الجمهور حق كتابة تقييم موثق على صفحة العرض.
 */
export default function VenueGateCheckinPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard/venue"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى لوحة المسرح
      </Link>

      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">لوحة التحكم</p>
        <h1 className="mt-2 flex items-center gap-2 font-serif text-3xl font-bold sm:text-4xl">
          <DoorOpen className="h-7 w-7 text-primary" />
          بوابة المسرح
        </h1>
        <p className="mt-2 text-muted-foreground">
          امسح تذكرة الحاضر أو أدخل كودها يدويًا — أخضر: مقبولة · أحمر: مستخدمة مسبقًا · أصفر: غير صالحة أو بانتظار الدفع.
        </p>
      </header>

      <section className="mt-8">
        <SectionTitle>مسح وتسجيل الحضور</SectionTitle>
        <div className="mt-4">
          <GateScanner />
        </div>
      </section>
    </div>
  )
}
