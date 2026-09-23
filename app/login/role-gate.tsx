"use client"

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Check, Drama, Loader2, Lock, LogOut, Mail, ShieldCheck, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ONBOARDING_PATH, ROLE_LABELS, ROLE_META, ROLE_ORDER, type AccountRole } from "@/lib/roles"
import { dashboardPathForUser, signIn, signOut, useSession } from "@/lib/session"

/** صور معبّرة عن كل نوع حساب (جمهور/ممثل/فرقة/مسرح) — تُستخدم ككروت وخلفيات ديناميكية. */
const ROLE_IMAGES: Record<AccountRole, string> = {
  customer: "/images/customer.jpg.jpeg",
  actor: "/images/actor.jpg.jpeg",
  troupe: "/images/troupe.jpg.jpeg",
  venue: "/images/venue.jpg.jpeg",
}

/** صورة بديلة آمنة تُعرض عند غياب صورة الدور أو فشل تحميلها. */
const ROLE_IMAGE_FALLBACK = "/placeholder.svg"

/** صورة دور آمنة باستخدام next/image: تملأ حاويتها وتتحوّل للبديلة عند فشل التحميل. */
function RoleImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <Image
      src={failed ? ROLE_IMAGE_FALLBACK : src}
      alt={alt}
      fill
      sizes="100vw"
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  )
}

/** إحداثيات هندسية لتوسّع البطاقة النشطة مقابل البقية. */
const ACTIVE_GROW = 2.6

/**
 * بوابة الدخول بأسلوب اختيار الشخصيات: أربع بطاقات رأسية تتوسّع البطاقة النشطة
 * أفقيًا (`flex-grow` transition) وتتضاءل البقية، مع إضاءة نيون بلون الفئة.
 * النقر على البطاقة يفتح مودال الدخول، ثم يُكمل المستخدم بياناته في `/onboarding`.
 */
export function RoleGate() {
  const [selected, setSelected] = useState<AccountRole>("customer")
  const [hoveredRole, setHoveredRole] = useState<AccountRole | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const user = useSession()
  const closeAuth = useCallback(() => setAuthOpen(false), [])

  const active = hoveredRole ?? selected
  const activeAccent = ROLE_META[active].accent

  const handleSelect = (role: AccountRole) => {
    setSelected(role)
    setAuthOpen(true)
  }

  return (
    <section className="relative isolate min-h-screen w-full overflow-hidden">
      {/* خلفية ديناميكية بكامل الشاشة: صورة الدور المحدد ظاهرة دائمًا، وصورة الدور
          الذي يقف عليه الماوس تتلاشى فوقها — فلا تظلم الصفحة أبدًا عند الابتعاد بالماوس. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {/* الطبقة الأساسية: الدور المحدد (selected) بشفافية كاملة دائمًا */}
        <RoleImage
          key={`base-${selected}`}
          src={ROLE_IMAGES[selected]}
          alt=""
          className="opacity-100"
        />

        {/* طبقة التمرير: تتقاطع بلطف مع الطبقة الأساسية عبر transition-opacity */}
        {ROLE_ORDER.map((role) => (
          <RoleImage
            key={`hover-${role}`}
            src={ROLE_IMAGES[role]}
            alt=""
            className={cn(
              "transition-opacity duration-700 ease-in-out",
              hoveredRole === role ? "opacity-100" : "opacity-0",
            )}
          />
        ))}

        {/* تعتيم خفيف + توهج نيون (vignette) — تباين كافٍ دون حجب الصورة */}
        <div className="absolute inset-0 bg-background/25" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_50%,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_-10%,rgba(245,196,81,0.10),transparent_65%)]" />

        {/* حاجز علوي (العنوان والشارة) وحاجز سفلي (البطاقات) لوضوح كامل للنصوص */}
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-background/85 via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/75 to-transparent" />

        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div
          className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-700"
          style={{ backgroundColor: `${activeAccent}1f` }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-10 sm:px-6">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
            <Drama className="h-3.5 w-3.5 text-primary" />
            بوابة كواليس
          </span>
          <h1 className="mt-5 font-serif text-4xl font-bold [text-shadow:0_2px_20px_rgba(0,0,0,0.7)] sm:text-5xl">
            اختر شخصيتك وابدأ
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground/80 [text-shadow:0_1px_12px_rgba(0,0,0,0.65)]">
            أربع مسارات في مسرح واحد: احجز مقعدك، قدّم على الأودشنات، أدِر فرقتك، أو املأ مقاعد مسرحك.
            مرّر على بطاقة لتتوسّع، وانقر عليها لبدء الدخول.
          </p>
        </header>

        {user && (
          <div className="mx-auto mt-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              مسجّل الدخول كـ <span className="font-semibold text-foreground">{user.name}</span> (
              {ROLE_LABELS[user.role]}){!user.onboarded && " — لم تكمل بياناتك بعد"}
            </span>
            <span className="flex items-center gap-2">
              <Link
                href={dashboardPathForUser(user)}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {user.onboarded ? "لوحتي" : "أكمل بياناتي"}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <LogOut className="h-3.5 w-3.5" />
                تسجيل الخروج
              </button>
            </span>
          </div>
        )}

        {/* البطاقات: تتوسّع النشطة وتتضاءل البقية عبر flex-grow */}
        <div className="mt-8 flex flex-1 flex-col gap-3 md:flex-row md:gap-4">
          {ROLE_ORDER.map((role) => (
            <RoleCard
              key={role}
              role={role}
              active={active === role}
              selected={selected === role}
              onHover={setHoveredRole}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-foreground/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
          الدخول تجريبي (بريد وكلمة مرور أو Google OAuth تجريبي) والجلسة تُحفظ في متصفحك فقط.
        </p>
      </div>

      <AuthModal role={selected} open={authOpen} onClose={closeAuth} />
    </section>
  )
}

/** بطاقة فئة واحدة: تتوسّع عند الوقوف/التحديد وتُضيء بلون النيون الخاص بالفئة. */
function RoleCard({
  role,
  active,
  selected,
  onHover,
  onSelect,
}: {
  role: AccountRole
  active: boolean
  selected: boolean
  onHover: (role: AccountRole | null) => void
  onSelect: (role: AccountRole) => void
}) {
  const meta = ROLE_META[role]

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${ROLE_LABELS[role]} — ${meta.cta}`}
      onMouseEnter={() => onHover(role)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(role)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(role)}
      className={cn(
        "group relative flex min-h-[136px] min-w-0 basis-0 flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl border p-5 text-center",
        "bg-card/75 backdrop-blur-md",
        "transition-[flex-grow,border-color,box-shadow] duration-500 ease-out md:min-h-0",
        active ? "border-transparent bg-card/90" : "border-border/60 hover:border-border",
      )}
      style={{
        flexGrow: active ? ACTIVE_GROW : 1,
        backgroundImage: active
          ? `radial-gradient(140% 90% at 50% 0%, ${meta.accent}3d, transparent 70%)`
          : "linear-gradient(180deg, rgba(255,255,255,0.02), transparent 60%)",
        boxShadow: active ? `0 0 0 1px ${meta.accent}66, 0 34px 80px -34px ${meta.accent}99` : undefined,
      }}
    >
      <span
        className={cn(
          "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 transition-all duration-500 ease-out",
          active && "scale-110 border-transparent",
        )}
        style={{ boxShadow: active ? `0 0 0 1px ${meta.accent}66, 0 18px 40px -18px ${meta.accent}99` : undefined }}
      >
        <RoleImage src={ROLE_IMAGES[role]} alt={ROLE_LABELS[role]} />
      </span>

      <span className="flex flex-col items-center gap-1">
        <span
          className="text-[11px] uppercase tracking-[0.2em] transition-colors duration-500"
          style={{ color: active ? meta.accent : undefined }}
        >
          {meta.code}
        </span>
        <span className="font-serif text-lg font-semibold sm:text-xl">{ROLE_LABELS[role]}</span>
        <span
          className={cn(
            "text-xs text-muted-foreground transition-opacity duration-500",
            active ? "opacity-100" : "opacity-0",
          )}
        >
          {meta.tagline}
        </span>
      </span>

      <span
        className={cn(
          "flex w-full flex-col items-start gap-1.5 overflow-hidden text-right transition-all duration-500",
          active ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {meta.bullets.map((bullet) => (
          <span key={bullet} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: meta.accent }} />
            {bullet}
          </span>
        ))}
      </span>

      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500",
          active ? "opacity-100" : "opacity-0 md:translate-y-2",
        )}
        style={{ backgroundColor: active ? meta.accent : "transparent", color: "#171310" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {meta.cta}
      </span>
    </button>
  )
}

/** مودال الدخول: بريد وكلمة مرور أو Google OAuth تجريبي، ثم التوجيه لإكمال البيانات. */
function AuthModal({ role, open, onClose }: { role: AccountRole; open: boolean; onClose: () => void }) {
  const meta = ROLE_META[role]
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError("")
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

  const goToOnboarding = () => startTransition(() => router.push(ONBOARDING_PATH))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail.includes("@") || trimmedEmail.length < 6) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.")
      return
    }
    if (password.trim().length < 4) {
      setError("كلمة المرور يجب أن تكون 4 أحرف على الأقل.")
      return
    }
    setError("")
    signIn({ email: trimmedEmail, role })
    goToOnboarding()
  }

  const continueWithGoogle = () => {
    setError("")
    signIn({ email: "demo.google@kawalees.test", role, provider: "google", name: "حساب Google" })
    goToOnboarding()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`الدخول — ${ROLE_LABELS[role]}`}
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
        className="absolute left-1/2 top-1/2 w-[min(92vw,440px)] overflow-hidden rounded-2xl border bg-card transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
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

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="gate-email" className="block text-xs text-muted-foreground">
              البريد الإلكتروني
            </label>
            <span className="relative mt-1 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={emailRef}
                id="gate-email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-left text-sm outline-none transition-colors focus:border-primary"
              />
            </span>
          </div>

          <div>
            <label htmlFor="gate-password" className="block text-xs text-muted-foreground">
              كلمة المرور
            </label>
            <span className="relative mt-1 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="gate-password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-left text-sm outline-none transition-colors focus:border-primary"
              />
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{ backgroundColor: meta.accent, color: "#171310" }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            دخول ومتابعة
          </button>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border/60" />
            أو
            <span className="h-px flex-1 bg-border/60" />
          </div>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            المتابعة بحساب Google (تجريبي)
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            بعد الدخول ننقلك لإكمال بياناتك ثم إلى لوحة فئتك. الجلسة تجريبية ومحفوظة في متصفحك فقط.
          </p>
        </form>
      </div>
    </div>
  )
}
