"use client"

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react"
import { AvatarPicker } from "@/components/avatar-picker"
import { cn } from "@/lib/utils"
import {
  DEMO_VENUE_INVITE_CODE,
  LOGIN_PATH,
  ROLE_DASHBOARD_PATH,
  ROLE_LABELS,
  ROLE_META,
  TELEGRAM_BOT_URL,
  dashboardPathForRole,
  type AccountRole,
} from "@/lib/roles"
import { completeOnboarding, useSession, type SessionProfile, type SessionUser } from "@/lib/session"

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

const AGE_GROUPS = ["أقل من 18", "18 – 24", "25 – 34", "35 – 44", "45+"] as const

type FormErrors = Partial<Record<keyof SessionProfile, string>>

/** يقرأ الجلسة ويعرض نموذج إكمال البيانات المناسب لفئة المستخدم. */
export function OnboardingForm() {
  const user = useSession()
  if (!user) return <MissingSessionCard />
  return <ProfileForm key={`${user.role}:${user.onboarded}`} user={user} />
}

function MissingSessionCard() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
        <p className="font-serif text-xl font-semibold">لا توجد جلسة نشطة</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          اختر فئتك وسجّل الدخول أولًا، ثم أكمل بياناتك من هنا.
        </p>
        <Link
          href={LOGIN_PATH}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          الذهاب إلى بوابة الدخول
        </Link>
      </div>
    </div>
  )
}

function ProfileForm({ user }: { user: SessionUser }) {
  const role = user.role
  const meta = ROLE_META[role]
  const router = useRouter()
  const [form, setForm] = useState<SessionProfile>(user.profile)
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, startTransition] = useTransition()

  function update<K extends keyof SessionProfile>(key: K, value: SessionProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateProfile(role, form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    startTransition(() => {
      const saved = completeOnboarding(form)
      router.push(saved ? dashboardPathForRole(saved.role) : LOGIN_PATH)
      router.refresh()
    })
  }

  /** يفتح بوت كواليس على تليجرام ويوسم الحساب كمربوط. */
  const linkTelegram = () => {
    window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer")
    update("telegramLinked", true)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header
        className="rounded-2xl border border-border/60 p-5"
        style={{ backgroundImage: `radial-gradient(120% 120% at 100% 0%, ${meta.accent}26, transparent 70%)` }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
          خطوة 2 من 2 — إكمال البيانات
        </span>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">{ROLE_LABELS[role]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{meta.tagline}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {user.email ? `مسجّل بـ ${user.email}` : "جلسة تجريبية محفوظة في متصفحك"} — أكمل الحقول لتفعيل
          لوحتك.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        <div>
          <AvatarPicker
            id="avatarUrl"
            label="الصورة الشخصية (Avatar)"
            value={form.avatarUrl}
            onChange={(value) => update("avatarUrl", value)}
            shape={role === "troupe" ? "square" : "circle"}
            hint="ارفع صورة من جهازك أو الصق رابطًا مباشرًا — تُصغَّر تلقائيًا وتُحفظ في جلسة متصفحك."
          />
          {errors.avatarUrl && <p className="mt-1 text-xs text-destructive-foreground">{errors.avatarUrl}</p>}
        </div>

        {role === "customer" && (
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-serif text-lg font-semibold">بيانات العميل</h2>
            <TextField
              id="fullName"
              label="الاسم الكامل"
              value={form.fullName}
              onChange={(value) => update("fullName", value)}
              placeholder="مثال: كريم عادل"
              error={errors.fullName}
            />
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-sm font-semibold">ربط الحساب بتليجرام</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                اربط حسابك لتصل تذكرتك الرقمية على تليجرام وتتابع حجوزاتك من البوت مباشرة.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={linkTelegram}
                  className="inline-flex items-center gap-2 rounded-full bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                  ربط الحساب بالتليجرام
                </button>
                {form.telegramLinked && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                    تم فتح بوت كواليس — أكمل الربط داخل تليجرام
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {role === "actor" && (
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-serif text-lg font-semibold">بيانات الفنان</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="stageName"
                label="الاسم الفني"
                value={form.stageName}
                onChange={(value) => update("stageName", value)}
                placeholder="مثال: كريم عادل"
                error={errors.stageName}
              />
              <SelectField
                id="ageGroup"
                label="السن / الفئة العمرية"
                value={form.ageGroup}
                onChange={(value) => update("ageGroup", value)}
                options={AGE_GROUPS}
                error={errors.ageGroup}
              />
              <TextField
                id="city"
                label="المدينة"
                value={form.city}
                onChange={(value) => update("city", value)}
                placeholder="مثال: القاهرة"
                error={errors.city}
              />
              <TextField
                id="portfolioUrl"
                label="رابط معرض الأعمال (Portfolio)"
                value={form.portfolioUrl}
                onChange={(value) => update("portfolioUrl", value)}
                placeholder="https://example.com/portfolio"
                dir="ltr"
                error={errors.portfolioUrl}
              />
            </div>
            <TextAreaField
              id="skills"
              label="الورش والمهارات"
              value={form.skills}
              onChange={(value) => update("skills", value)}
              placeholder="مثال: ورشة ارتجال 2025 — تمثيل كوميدي، إلقاء شعري، غناء"
              error={errors.skills}
            />
          </section>
        )}

        {role === "troupe" && (
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-serif text-lg font-semibold">بيانات الفرقة</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="troupeName" label="اسم الفرقة" value={form.troupeName} onChange={(v) => update("troupeName", v)} placeholder="مثال: مسرح الحر المستقل" error={errors.troupeName} />
              <TextField id="directorName" label="اسم المخرج" value={form.directorName} onChange={(v) => update("directorName", v)} placeholder="مثال: منى فاروق" error={errors.directorName} />
              <TextField id="vodafoneCash" label="رقم فودافون كاش" value={form.vodafoneCash} onChange={(v) => update("vodafoneCash", v)} placeholder="01012345678" dir="ltr" error={errors.vodafoneCash} />
              <TextField id="instaPay" label="معرف إنستا باي (InstaPay)" value={form.instaPay} onChange={(v) => update("instaPay", v)} placeholder="name@instapay" dir="ltr" error={errors.instaPay} />
            </div>
            <div>
              <AvatarPicker
                id="logoUrl"
                label="رابط الشعار (Logo)"
                value={form.logoUrl}
                onChange={(value) => update("logoUrl", value)}
                shape="square"
                hint="شعار الفرقة كما يظهر في صفحة العرض وبطاقات الحجز."
              />
              {errors.logoUrl && <p className="mt-1 text-xs text-destructive-foreground">{errors.logoUrl}</p>}
            </div>
            <TextAreaField
              id="bio"
              label="نبذة تعريفية"
              value={form.bio}
              onChange={(value) => update("bio", value)}
              placeholder="اكتب نبذة عن الفرقة، أعمالها السابقة، ونوع العروض التي تقدّمها."
              error={errors.bio}
            />
          </section>
        )}

        {role === "venue" && (
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-serif text-lg font-semibold">بيانات المسرح</h2>
            <TextField
              id="venueName"
              label="اسم المسرح"
              value={form.venueName}
              onChange={(value) => update("venueName", value)}
              placeholder="مثال: مسرح الهوسابير"
              hint="اختياري — يظهر في لوحتك وتقارير الإشغال."
            />

            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <TextField
                id="inviteCode"
                label="رمز الدعوة (Invite Code) *"
                value={form.inviteCode}
                onChange={(value) => update("inviteCode", value)}
                placeholder="KAWALEES-2026"
                dir="ltr"
                error={errors.inviteCode}
                hint={`حقل إجباري ولا يكتمل الحساب بدونه. رمز التجربة: ${DEMO_VENUE_INVITE_CODE}`}
              />
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary underline-offset-4 transition-colors hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                لا تملك كود دعوة؟ تواصل مع إدارة كواليس لتفعيل مسرحك
              </a>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            نحفظ بياناتك في جلسة متصفحك ثم نوجّهك مباشرة إلى{" "}
            <span className="font-medium text-foreground">{ROLE_DASHBOARD_PATH[role]}</span> ·{" "}
            {ROLE_LABELS[role]}
          </p>
          <button
            type="submit"
            disabled={pending}
            style={{ backgroundColor: meta.accent, color: "#171310" }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            حفظ ومتابعة إلى لوحتي
          </button>
        </div>
      </div>
    </form>
  )
}

/** تحقق مبسّط لكل فئة: رمز دعوة المسرح إلزامي، وباقي الحقول حسب الفئة. */
function validateProfile(role: AccountRole, form: SessionProfile): FormErrors {
  const errors: FormErrors = {}
  const isLink = (value: string) => /^(https?:\/\/|data:image\/)/i.test(value)

  if (form.avatarUrl.trim() && !isLink(form.avatarUrl.trim())) {
    errors.avatarUrl = "استخدم رابطًا يبدأ بـ https:// أو ارفع صورة من جهازك."
  }

  if (role === "customer" && form.fullName.trim().length < 3) {
    errors.fullName = "اكتب اسمك الكامل (3 أحرف على الأقل)."
  }

  if (role === "actor") {
    if (form.stageName.trim().length < 2) errors.stageName = "اكتب اسمك الفني."
    if (!form.ageGroup) errors.ageGroup = "اختر السن أو الفئة العمرية."
    if (form.city.trim().length < 2) errors.city = "اكتب المدينة."
    if (form.portfolioUrl.trim() && !isLink(form.portfolioUrl.trim())) {
      errors.portfolioUrl = "رابط معرض الأعمال غير صالح."
    }
  }

  if (role === "troupe") {
    if (form.troupeName.trim().length < 2) errors.troupeName = "اكتب اسم الفرقة."
    if (form.directorName.trim().length < 3) errors.directorName = "اكتب اسم المخرج."
    if (!/^01[0125][0-9]{8}$/.test(form.vodafoneCash.trim())) {
      errors.vodafoneCash = "رقم فودافون كاش غير صحيح (11 رقمًا يبدأ بـ 01)."
    }
    if (form.instaPay.trim().length < 3) errors.instaPay = "اكتب معرف إنستا باي."
    if (form.logoUrl.trim() && !isLink(form.logoUrl.trim())) errors.logoUrl = "رابط الشعار غير صالح."
  }

  if (role === "venue" && form.inviteCode.trim().length < 6) {
    errors.inviteCode = "رمز الدعوة مطلوب ولا يكتمل الحساب بدونه."
  }

  return errors
}

/** حقل بسيط مع تسمية ورسالة خطأ/تلميح. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive-foreground">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  dir = "rtl",
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string
  dir?: "rtl" | "ltr"
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={id}
        dir={dir}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(INPUT_CLASS, dir === "ltr" && "text-left")}
      />
    </Field>
  )
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(INPUT_CLASS, "resize-y")}
      />
    </Field>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  hint?: string
  error?: string
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">اختر…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  )
}
