"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CalendarDays, MapPin, Mic, Plus } from "lucide-react"
import { formatDate, formatPrice } from "@/lib/format"
import type { TroupeWallet } from "@/lib/dashboards"
import type { EventWithRelations } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { SectionTitle, StatCard, StatusBadge } from "@/app/dashboard/ui"
import { TicketScanner } from "@/app/dashboard/troupe/ticket-scanner"
import { ShowWizard } from "@/app/dashboard/troupe/show-wizard"
import { useState } from "react"
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  SHOW_STATUS_LABELS,
  createAudition,
  setApplicationStatus,
  setAuditionStatus,
  useWorkspace,
  type ApplicationStatus,
  type Audition,
  type AuditionApplication,
} from "@/lib/productions"

/**
 * البيانات التي يجلبها الـ Server Component (`page.tsx`) ويُمرّرها جاهزة.
 * الاستيراد أعلاه `import type` فقط، لذا لا تدخل بيانات السيرفر (`pg`) في حزمة المتصفح.
 */
export type TroupeDashboardClientProps = {
  troupe: { name: string; city: string | null } | null
  wallet: TroupeWallet
  shows: EventWithRelations[]
  venueOptions: string[]
}

/** أزرار تغيير حالة المتقدم في الأودشن: مرحلة ثانية / قائمة قصيرة / استبعاد. */
function ApplicationStatusControls({ application }: { application: AuditionApplication }) {
  const choices: { status: ApplicationStatus; label: string; classes: string }[] = [
    { status: "second_round", label: "قبول للمرحلة الثانية", classes: "bg-emerald-600 text-white" },
    { status: "shortlist", label: "قائمة قصيرة", classes: "border-amber-500/50 text-amber-200" },
    { status: "rejected", label: "استبعاد", classes: "border-destructive/60 text-destructive-foreground" },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices
        .filter((choice) => choice.status !== application.status)
        .map((choice) => (
          <button
            key={choice.status}
            type="button"
            onClick={() => setApplicationStatus(application.id, choice.status)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-90", choice.classes)}
          >
            {choice.label}
          </button>
        ))}
    </div>
  )
}


/** بطاقة أودشن واحد: بياناته، حالته، وجدول متقدميه بأزرار الحسم. */
function TroupeAuditionCard({ audition, applications }: { audition: Audition; applications: AuditionApplication[] }) {
  const applicants = applications.filter((application) => application.auditionId === audition.id)
  return (
    <article className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold">{audition.title}</h3>
        <div className="flex items-center gap-2">
          <StatusBadge tone={audition.status === "open" ? "green" : "gray"}>
            {audition.status === "open" ? "مفتوح" : "مغلق"}
          </StatusBadge>
          <button
            type="button"
            onClick={() => setAuditionStatus(audition.id, audition.status === "open" ? "closed" : "open")}
            className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            {audition.status === "open" ? "إغلاق الأودشن" : "إعادة فتح"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        الدور: {audition.role} · {audition.venue} · {audition.date} · {audition.pay}
      </p>
      {audition.requirements && <p className="mt-1 text-xs text-muted-foreground">المتطلبات: {audition.requirements}</p>}
      <h4 className="mt-4 text-xs font-semibold text-muted-foreground">المتقدمون ({applicants.length})</h4>
      {applicants.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">لا متقدمين بعد على هذا الأودشن.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {applicants.map((application) => (
            <div key={application.id} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{application.actorName}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {application.actorEmail}
                  </p>
                </div>
                <StatusBadge tone={APPLICATION_STATUS_TONES[application.status]}>
                  {APPLICATION_STATUS_LABELS[application.status]}
                </StatusBadge>
              </div>
              {application.status !== "rejected" && (
                <div className="mt-2">
                  <ApplicationStatusControls application={application} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

/** نموذج نشر أودشن جديد في مساحة العمل. */
function NewAuditionForm() {
  const [form, setForm] = useState({ title: "", role: "", requirements: "", pay: "", venue: "", date: "" })
  const [notice, setNotice] = useState<string | null>(null)
  const fieldClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }))
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (form.title.trim().length < 3) {
          setNotice("عنوان الأودشن مطلوب.")
          return
        }
        createAudition({ productionId: null, ...form })
        setNotice(`تم نشر الأودشن «${form.title}».`)
        setForm({ title: "", role: "", requirements: "", pay: "", venue: "", date: "" })
      }}
      className="space-y-3"
    >
      <input id="audition-title" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="عنوان الأودشن *" className={fieldClass} />
      <input value={form.role} onChange={(event) => update("role", event.target.value)} placeholder="الدور المطلوب" className={fieldClass} />
      <input value={form.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="المتطلبات" className={fieldClass} />
      <input value={form.pay} onChange={(event) => update("pay", event.target.value)} placeholder="الأجر (مثال: 3000 ج.م للعرض)" className={fieldClass} />
      <input value={form.venue} onChange={(event) => update("venue", event.target.value)} placeholder="مكان الأودشن" className={fieldClass} />
      <input value={form.date} onChange={(event) => update("date", event.target.value)} placeholder="الموعد" className={fieldClass} />
      <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
        نشر الأودشن
      </button>
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {notice}
        </p>
      )}
    </form>
  )
}

export function TroupeDashboardClient({ troupe, wallet, shows, venueOptions }: TroupeDashboardClientProps) {
  const workspace = useWorkspace()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const goToAuditionForm = () => {
    document.getElementById("audition-publish")?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => document.getElementById("audition-title")?.focus(), 450)
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى العروض
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-primary">لوحة التحكم</p>
          <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
            {troupe ? `فرقة ${troupe.name}` : "لوحة الفرقة"}
          </h1>
          {troupe?.city && <p className="mt-2 text-muted-foreground">{troupe.city}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setWizardOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            إنشاء عرض مسرحي جديد
          </button>
          <button
            type="button"
            onClick={goToAuditionForm}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/20"
          >
            <Mic className="h-4 w-4" />
            نشر أوديشن جديد
          </button>
        </div>
      </header>

      {/* قائمة الإجراءات السريعة */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <span className="text-xs text-muted-foreground">إجراءات سريعة:</span>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setWizardOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          إنشاء عرض مسرحي جديد
        </button>
        <button
          type="button"
          onClick={goToAuditionForm}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Mic className="h-3.5 w-3.5" />
          نشر أوديشن جديد
        </button>
      </div>

      {wizardOpen && (
        <div className="mt-6">
          <ShowWizard
            venueOptions={venueOptions}
            editingId={editingId}
            onClose={() => {
              setWizardOpen(false)
              setEditingId(null)
            }}
          />
        </div>
      )}

      <section className="mt-8">
        <SectionTitle>المحفظة والأرباح</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="إجمالي المبيعات" value={formatPrice(wallet.grossCents)} hint={`${wallet.bookingsCount} حجز مؤكد`} />
          <StatCard label="التذاكر المباعة" value={String(wallet.ticketsSold)} hint="من حجوزات Neon" />
          <StatCard label="عمولة المنصة" value={formatPrice(wallet.platformFeeCents)} hint="رسوم الخدمة المحصّلة" />
          <StatCard label="الأرباح الصافية" value={formatPrice(wallet.netCents)} hint="بعد خصم عمولة المنصة" />
        </div>
      </section>
      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionTitle>عروض الفرقة</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {shows.map((show) => (
              <article key={show.id} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    src={show.heroUrl ?? show.posterUrl ?? "/placeholder.svg"}
                    alt={`مشهد من عرض ${show.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-serif text-lg font-semibold">{show.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(show.startsAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {show.venue.name}، {show.venue.city}
                  </p>
                  <p className="mt-2 text-sm">
                    تبدأ من <span className="font-semibold">{formatPrice(Math.min(...show.priceTiers.map((t) => t.priceCents)))}</span>
                  </p>
                </div>
              </article>
            ))}
            {shows.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد عروض مسجلة لهذه الفرقة بعد.</p>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <SectionTitle>أعمالك في مساحة العمل</SectionTitle>
            <p className="mt-2 text-xs text-muted-foreground">
              الأعمال المنشورة عبر النموذج بحالة «قريبًا» — اضغط تعديل لإكمال التفاصيل.
            </p>
            <div className="mt-4 space-y-2">
              {workspace.productions.length === 0 && (
                <p className="text-xs text-muted-foreground">لم تنشر أي عمل مسرحي بعد.</p>
              )}
              {workspace.productions.map((production) => (
                <div key={production.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{production.title}</p>
                    <StatusBadge tone={production.status === "on_sale" ? "green" : production.status === "coming_soon" ? "amber" : "gray"}>
                      {SHOW_STATUS_LABELS[production.status]}
                    </StatusBadge>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(production.id)
                      setWizardOpen(true)
                    }}
                    className="shrink-0 rounded-full border border-border/60 px-3 py-1 text-xs transition-colors hover:bg-secondary"
                  >
                    تعديل
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionTitle>مديول الأودشنات</SectionTitle>
          <div className="mt-4 space-y-4">
            {workspace.auditions.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا أودشنات منشورة بعد — ابدأ بنشر أودشن من الجانب.</p>
            ) : (
              workspace.auditions.map((audition) => (
                <TroupeAuditionCard key={audition.id} audition={audition} applications={workspace.applications} />
              ))
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div id="audition-publish" className="rounded-xl border border-primary/30 bg-card p-5">
            <SectionTitle>إضافة طلب أودشن جديد</SectionTitle>
            <div className="mt-4">
              <NewAuditionForm />
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-12">
        <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
          <SectionTitle>ماسح تذاكر البوابة</SectionTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            أدخل مرجع التذكرة للتحقق من صحتها عند دخول المسرح.
          </p>
          <div className="mt-4 max-w-md">
            <TicketScanner />
          </div>
        </div>
      </section>
    </div>
  )
}