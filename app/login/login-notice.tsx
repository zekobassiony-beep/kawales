"use client"

import { useSearchParams } from "next/navigation"
import { AlertTriangle, ShieldAlert } from "lucide-react"

/**
 * تنبيه أعلى بوابة الدخول يشرح سبب الرجوع للصفحة.
 *
 * كان الوسيط ومسار `/auth/callback` يُعيدان المستخدم إلى `/login?error=auth`
 * أو `/login?denied=1` **بلا أي رسالة**، فيظن المستخدم أن الدخول «لم يكتمل»
 * دون معرفة السبب. هذا المكوّن يقرأ السبب من الرابط ويعرضه بالعربية.
 */
export function LoginNotice() {
  const params = useSearchParams()
  const error = params.get("error")
  const denied = params.get("denied")

  if (error !== "auth" && denied !== "1") return null

  const isDenied = denied === "1"

  return (
    <div
      role="status"
      className="mx-auto mt-4 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-right text-xs text-amber-100 sm:text-sm"
    >
      {isDenied ? (
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="leading-relaxed">
        {isDenied ? (
          <>
            هذا البريد لا يملك صلاحية لوحة الإدارة. إن كنت من فريق كواليس، اطلب من السوبر أدمن إضافتك ثم أعد
            المحاولة.
          </>
        ) : (
          <>
            لم تكتمل عملية الدخول. أعد المحاولة من البداية، وتأكد من السماح بالنوافذ المنبثقة (Pop-ups) عند
            الدخول بحساب Google.
          </>
        )}
      </span>
    </div>
  )
}
