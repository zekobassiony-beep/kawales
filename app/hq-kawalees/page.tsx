import { HqGate } from "@/app/hq-kawalees/hq-gate"
import { HqShell } from "@/app/hq-kawalees/hq-shell"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "كواليس | غرفة العمليات",
  description: "لوحة التحكم العليا لمنصة كواليس — صلاحيات محدودة لفريق الإدارة.",
  robots: { index: false, follow: false },
}

/**
 * المسار المخفي لغرفة عمليات كواليس `/hq-kawalees`.
 * لا تُعرض إلا لبريد الأدمن الرئيسي (Superadmin) — وأي زائر آخر يُحوَّل للرئيسية
 * عبر `HqGate` قبل ظهور أي محتوى إداري.
 */
export default function HqPage() {
  return (
    <HqGate>
      <HqShell />
    </HqGate>
  )
}
