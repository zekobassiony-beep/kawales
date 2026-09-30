"use client"

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Lock, Mail, UserPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLE_LABELS, ROLE_META, ONBOARDING_PATH, type AccountRole } from "@/lib/roles"
import {
  applySupabaseUser,
  dashboardPathForUser,
  mergeServerProfile,
  type SessionUser,
} from "@/lib/session"
import { ADMIN_DASHBOARD_PATH, isMasterAdminEmail } from "@/lib/auth-constants"
import { AddPasswordPanel } from "@/app/login/add-password-panel"
import { loadMyProfile, saveMyProfile } from "@/app/actions/profile"
import {
  getSupabaseAuthUser,
  isAuthConfigured,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/supabase/auth-client"

/**
 * نافذة الدخول وإنشاء الحساب — **مصادقة حقيقية** عبر Supabase Auth.
 *
 * - «إنشاء حساب» يُنشئ مستخدمًا فعليًا محفوظًا (بريد + كلمة مرور).
 * - «تسجيل الدخول» يتحقق من كلمة المرور الحقيقية؛ لا يمكن الدخول بأي بيانات وهمية.
 * - لا يوجد أي كود تحقق بالبريد (Email OTP) هنا.
 */

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
  "w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-left text-sm outline-none transition-colors focus:border-primary"

type Mode = "signin" | "signup"

export function AuthModal({
  role,
  open,
  onClose,
}: {
  role: AccountRole
  open: boolean
  onClose: () => void
}) {
  const meta = ROLE_META[role]
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState<"submit" | "google" | null>(null)
  /** البريد مسجَّل بحساب جوجل ⇒ نُبرز زر «المتابعة بحساب Google». */
  const [googleOnly, setGoogleOnly] = useState(false)
  const [, startTransition] = useTransition()
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError("")
    setNotice("")
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    emailRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  /** بعد نجاح المصادقة: تُطبَّق جلسة Supabase على جلسة المنصة ثم التوجيه. */
  const finishAuth = async (normalizedEmail: string) => {
    const user = await getSupabaseAuthUser()
    const applied = applySupabaseUser(user, role)

    // الجلسة المحلية تُمسح عند تسجيل الخروج، فبدون قراءة الملف من قاعدة البيانات
    // كان المستخدم يُعاد إلى `/onboarding` في كل دخول. نقرأه هنا ونطبّقه **قبل**
    // التوجيه، وإن كان الحساب جديدًا (بلا صف) نُنشئ صفّه فورًا في الداتا.
    const remote = await loadMyProfile()
    let resolved: SessionUser | null = applied
    if (remote.ok) {
      if (remote.profile) {
        resolved = mergeServerProfile(remote.profile, normalizedEmail) ?? applied
      } else if (applied) {
        await saveMyProfile({ role: applied.role, onboarded: applied.onboarded, profile: applied.profile })
      }
    } else {
      setNotice(
        "الحساب يعمل، لكن حفظ الملف الدائم يحتاج تشغيل scripts/profiles-schema.sql مرة واحدة من SQL Editor في Supabase.",
      )
    }

    startTransition(() => {
      if (isMasterAdminEmail(normalizedEmail)) {
        router.push(ADMIN_DASHBOARD_PATH)
        router.refresh()
        return
      }
      router.replace(resolved ? dashboardPathForUser(resolved) : ONBOARDING_PATH)
      router.refresh()
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setNotice("")

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.")
      return
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.")
      return
    }
    if (mode === "signup" && password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.")
      return
    }
    if (!isAuthConfigured()) {
      setError("المصادقة غير مهيأة على هذا الموقع — تواصل مع فريق كواليس.")
      return
    }

    setPending("submit")
    try {
      if (mode === "signup") {
        const result = await signUpWithPassword(normalizedEmail, password, {
          next: `/onboarding?role=${role}`,
          role,
        })
        if (!result.ok) {
          setError(result.error ?? "تعذّر إنشاء الحساب.")
          setGoogleOnly(result.provider === "google")
          return
        }
        if (result.needsSignIn || result.needsEmailConfirmation) {
          setNotice("هذا البريد مسجّل بالفعل بحساب فعّال — اكتب كلمة مروره ثم اضغط «دخول ومتابعة».")
          setMode("signin")
          return
        }
        await finishAuth(normalizedEmail)
        return
      }

      const result = await signInWithPassword(normalizedEmail, password)
      if (!result.ok) {
        setError(result.error ?? "تعذّر تسجيل الدخول.")
        return
      }
      await finishAuth(normalizedEmail)
    } finally {
      setPending(null)
    }
  }

  const handleGoogle = async () => {
    setError("")
    setNotice("")
    setPending("google")
    const result = await signInWithGoogle({ role, next: `/onboarding?role=${role}` })
    if (!result.ok) {
      setError(result.error ?? "تعذّر الدخول بجوجل.")
      setPending(null)
    }
    // عند النجاح يُحوَّل المتصفح إلى Google ثم يعود إلى /auth/callback.
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"} — ${ROLE_LABELS[role]}`}
      className={cn(
        "fixed inset-0 z-[70] transition-all duration-300",
        open ? "visible opacity-100" : "invisible opacity-0",
      )}
    >
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div
        className="absolute left-1/2 top-1/2 max-h-[92vh] w-[min(92vw,440px)] overflow-y-auto rounded-2xl border bg-card transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          borderColor: `${meta.accent}59`,
          boxShadow: `0 40px 90px -40px ${meta.accent}b3`,
          transform: open ? "translate(-50%,-50%) scale(1)" : "translate(-50%,-50%) scale(0.94)",
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4"
          style={{ backgroundImage: `radial-gradient(120% 120% at 100% 0%, ${meta.accent}26, transparent 70%)` }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.emoji}</span>
            <span>
              <span className="block text-[11px] uppercase tracking-[0.2em]" style={{ color: meta.accent }}>
                {meta.code}
              </span>
              <span className="block font-serif text-lg font-semibold">{ROLE_LABELS[role]}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* تبديل بين تسجيل الدخول وإنشاء حساب جديد */}
        <div className="flex gap-2 px-5 pt-4">
          {(
            [
              { id: "signin" as Mode, label: "تسجيل الدخول" },
              { id: "signup" as Mode, label: "إنشاء حساب جديد" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id)
                setError("")
                setNotice("")
              }}
              aria-pressed={mode === tab.id}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                mode === tab.id
                  ? "border-transparent text-[#171310]"
                  : "border-border/60 text-muted-foreground hover:bg-secondary",
              )}
              style={mode === tab.id ? { backgroundColor: meta.accent } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
<form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="auth-email" className="block text-xs text-muted-foreground">
              البريد الإلكتروني
            </label>
            <span className="relative mt-1 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={emailRef}
                id="auth-email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={FIELD}
              />
            </span>
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs text-muted-foreground">
              كلمة المرور
            </label>
            <span className="relative mt-1 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="auth-password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={FIELD}
              />
            </span>
            {mode === "signup" && <p className="mt-1 text-[11px] text-muted-foreground">6 أحرف على الأقل.</p>}
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="auth-confirm" className="block text-xs text-muted-foreground">
                تأكيد كلمة المرور
              </label>
              <span className="relative mt-1 block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="auth-confirm"
                  name="confirm"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                  className={FIELD}
                />
              </span>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
            >
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] leading-relaxed text-emerald-200">
              {notice}
            </p>
          )}
<button
            type="submit"
            disabled={pending !== null}
            style={{ backgroundColor: meta.accent, color: "#171310" }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {mode === "signup" ? "إنشاء الحساب والمتابعة" : "دخول ومتابعة"}
          </button>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border/60" />
            أو
            <span className="h-px flex-1 bg-border/60" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={pending !== null}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60",
              googleOnly
                ? "border-primary ring-2 ring-primary/50"
                : "border-border/70",
            )}
          >
            {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo className="h-4 w-4" />}
            المتابعة بحساب Google
          </button>

          <AddPasswordPanel />

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {mode === "signup"
              ? "حساب حقيقي محفوظ على المنصة — تستخدمه لاحقًا في حجز تذاكرك ومتابعة حجوزاتك."
              : "أدخل البريد وكلمة المرور الخاصين بحسابك على كواليس."}
          </p>
        </form>
      </div>
    </div>
  )
}