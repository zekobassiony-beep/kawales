import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { LOGIN_PATH } from "@/lib/roles"
import { MASTER_ADMIN_EMAIL } from "@/lib/auth-constants"

/**
 * شاشة «403 — غير مصرّح بالدخول» تُعرض لأي جلسة ليست ضمن أدمنز المنصة.
 */
export function NoAccessPanel({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive-foreground">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-serif text-2xl font-bold">403 — غير مصرّح بالدخول</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          هذه المنطقة مخصّصة لأدمنز منصة كواليس فقط
          {email ? (
            <>
              {" "}
              — البريد الحالي <span className="font-mono" dir="ltr">{email}</span> غير مسجّل في جدول{" "}
              <code className="font-mono">admin_users</code>.
            </>
          ) : (
            "."
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          لطلب الصلاحية تواصل مع السوبر أدمن الأساسي{" "}
          <span className="font-mono" dir="ltr">{MASTER_ADMIN_EMAIL}</span>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-border/60 px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            العودة للرئيسية
          </Link>
          <Link
            href={LOGIN_PATH}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            تسجيل الدخول بحساب أدمن
          </Link>
        </div>
      </div>
    </div>
  )
}
