"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Check, Drama, LogOut, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLE_LABELS, ROLE_META, ROLE_ORDER, isAccountRole, type AccountRole } from "@/lib/roles"
import { dashboardPathForUser, signOut, useSession } from "@/lib/session"
import { ADMIN_DASHBOARD_PATH } from "@/lib/auth-constants"
import { useAdminAccess } from "@/components/use-admin-access"
import { AuthModal } from "@/app/login/auth-modal"
import { LoginNotice } from "@/app/login/login-notice"

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
  const admin = useAdminAccess()
  const closeAuth = useCallback(() => setAuthOpen(false), [])
  const searchParams = useSearchParams()

  /*
   * تشغيل آلي لمسار الدخول: `/login?role=troupe&auth=1` يفتح نافذة الدخول على
   * الفئة المطلوبة مباشرة، فيستطيع مشغّل الاختبار الآلي (E2E) ملء البريد وكلمة
   * المرور بلا الحاجة إلى النقر على بطاقة الفئة أولًا — وهذا هو السبب الذي كان
   * يجعل خطوة «الدخول» تفشل في كل التدفقات. لا يتأثر الزائر العادي: لا شيء يفتح
   * تلقائيًا إلا عند وجود `auth=1` أو `role=` صريح في الرابط.
   */
  useEffect(() => {
    const roleParam = searchParams.get("role")
    if (isAccountRole(roleParam)) setSelected(roleParam)
    if (searchParams.get("auth") === "1" || isAccountRole(roleParam)) setAuthOpen(true)
  }, [searchParams])

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

        {/* سبب الرجوع للصفحة (فشل الدخول بجوجل أو عدم صلاحية) — كان صامتًا قبل ذلك. */}
        <LoginNotice />

        {user && (
          <div className="mx-auto mt-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              مسجّل الدخول كـ <span className="font-semibold text-foreground">{user.name}</span> (
              {ROLE_LABELS[user.role]}){!user.onboarded && " — لم تكمل بياناتك بعد"}
            </span>
            <span className="flex items-center gap-2">
              {admin.allowed && (
                <Link
                  href={ADMIN_DASHBOARD_PATH}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  لوحة الإدارة
                </Link>
              )}
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
          أنشئ حسابك ببريدك وكلمة مرور، أو تابع بحساب Google — حسابك يُحفظ على المنصة لتتابع حجوزاتك وتذاكرك.
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
      data-testid={`role-card-${role}`}
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
