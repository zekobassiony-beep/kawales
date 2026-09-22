"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ShieldAlert } from "lucide-react"
import { useSession } from "@/lib/session"
import { HQ_PATH, LOGIN_PATH, isSuperadmin } from "@/lib/roles"

/**
 * الحماية والدخول المقيّد لغرفة العمليات `/hq-kawalees`:
 * لا يراها إلا بريد الأدمن الرئيسي (Superadmin) — وأي زائر آخر يُحوَّل فورًا
 * إلى الصفحة الرئيسية.
 */
export function HqGate({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const router = useRouter()
  const allowed = isSuperadmin(session?.email)

  useEffect(() => {
    if (!allowed) router.replace("/")
  }, [allowed, router])

  if (!allowed) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="font-serif text-2xl font-bold">منطقة مقيّدة</h1>
        <p className="text-sm text-muted-foreground">
          هذه غرفة عمليات كواليس الداخلية. سيتم تحويلك إلى الصفحة الرئيسية…
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          جارٍ التحقق من الصلاحيات
        </div>
        <p className="text-[11px] text-muted-foreground">
          إن كنت من فريق كواليس، سجّل الدخول بالبريد الإداري (
          <span className="font-mono">admin@kawalees.test</span>) من{" "}
          <Link href={LOGIN_PATH} className="underline">
            صفحة الدخول
          </Link>
          ، ثم افتح <span className="font-mono">{HQ_PATH}</span>.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
