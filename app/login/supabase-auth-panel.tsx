"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, MailCheck, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSupabaseAuthUser, sendEmailOtp, signInWithGoogle, verifyEmailOtp } from "@/lib/supabase/auth-client"
import { applySupabaseUser, dashboardPathForUser } from "@/lib/session"
import { isAccountRole, type AccountRole } from "@/lib/roles"

/** شعار Google الرسمي (SVG مضمّن بلا صور خارجية). */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.74 12 4.74Z"
      />
    </svg>
  )
}

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/**
 * دخول Supabase Auth الرسمي داخل نافذة الدخول:
 *  - زر Google (OAuth) مع شعار رسمي.
 *  - كود تحقق البريد (Email OTP): إرسال الرمز ثم إدخال 6 أرقام والتحقق.
 */
export function SupabaseAuthPanel({ role, accent }: { role: AccountRole; accent: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [stage, setStage] = useState<"email" | "code">("email")
  const [pending, setPending] = useState<"google" | "send" | "verify" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const safeRole: AccountRole = isAccountRole(role) ? role : "customer"

  const handleGoogle = async () => {
    setError("")
    setNotice("")
    setPending("google")
    const result = await signInWithGoogle({ role: safeRole, next: `/onboarding?role=${safeRole}` })
    if (!result.ok) {
      setError(result.error ?? "تعذّر الدخول بجوجل.")
      setPending(null)
    }
    // عند النجاح يتم تحويل المتصفح إلى Google ثم إلى /auth/callback.
  }

  const handleSendCode = async () => {
    setError("")
    setNotice("")
    setPending("send")
    const result = await sendEmailOtp(email, { role: safeRole, next: `/onboarding?role=${safeRole}` })
    setPending(null)
    if (!result.ok) {
      setError(result.error ?? "تعذّر إرسال الكود.")
      return
    }
    setStage("code")
    setNotice(
      `أرسلنا كودًا من 6 أرقام إلى ${email.trim().toLowerCase()} — تحقّق من بريدك (وصندوق الرسائل غير المرغوبة).`,
    )
  }

  const handleVerify = async () => {
    setError("")
    setPending("verify")
    const result = await verifyEmailOtp(email, code)
    if (!result.ok) {
      setPending(null)
      setError(result.error ?? "كود غير صحيح.")
      return
    }
    const user = await getSupabaseAuthUser()
    const applied = applySupabaseUser(user, safeRole)
    setPending(null)
    router.replace(dashboardPathForUser(applied))
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending !== null}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border/70 bg-white px-6 py-2.5 text-sm font-semibold text-[#1f1f1f] shadow-sm transition-all hover:bg-white/90 hover:shadow-md disabled:opacity-60"
      >
        {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo className="h-4 w-4" />}
        تسجيل الدخول باستخدام Google
      </button>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border/60" />
        أو عبر كود البريد
        <span className="h-px flex-1 bg-border/60" />
      </div>

      {stage === "email" ? (
        <div className="space-y-2">
          <label htmlFor="otp-email" className="block text-xs text-muted-foreground">
            كود التحقق عبر البريد / Email OTP
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="otp-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSendCode()
              }}
              placeholder="you@example.com"
              className={cn(FIELD, "text-left")}
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={pending !== null || email.trim().length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {pending === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              أرسل الكود
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="otp-code" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MailCheck className="h-3.5 w-3.5" />
            أدخل الكود المكوّن من 6 أرقام
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="otp-code"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleVerify()
              }}
              placeholder="123456"
              className={cn(FIELD, "text-center font-mono text-lg tracking-[0.4em]")}
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={pending !== null || code.length !== 6}
              style={{ backgroundColor: accent, color: "#171310" }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              تحقّق ودخول
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStage("email")
              setCode("")
              setNotice("")
            }}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            تغيير البريد
          </button>
        </div>
      )}

      {notice && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive-foreground"
        >
          {error}
        </p>
      )}
    </div>
  )
}

