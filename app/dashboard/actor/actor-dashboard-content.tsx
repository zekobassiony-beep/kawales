"use client"

import { useMemo, useState } from "react"
import { ArrowRight, LogOut, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { AuditionCard } from "@/app/dashboard/actor/audition-card"
import { StatusBadge } from "@/app/dashboard/ui"
import { ActorAchievementForm } from "@/components/actor-achievement-form"
import { SocialShareButton } from "@/components/social-share-button"
import { AvatarPicker } from "@/components/avatar-picker"
import { cn } from "@/lib/utils"
import {
  ACHIEVEMENT_KIND_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  activeWorksForActor,
  archivedWorksForActor,
  applyToAudition,
  pendingInvitesForActor,
  removeAchievement,
  setCrewStatus,
  useWorkspace,
  type Achievement,
  type CrewMember,
  type Production,
  type ViewerIdentity,
} from "@/lib/productions"
import type { Audition as PublicAudition } from "@/lib/dashboards"
import { signOut, updateProfile, useSession } from "@/lib/session"

const ACTOR_VIEWER: ViewerIdentity = { name: "أحمد فؤاد", email: "ahmed@kawalees.test" }

/**
 * محتوى لوحة الممثل: الدعوات المعلقة، الأعمال النشطة، أرشيف سابقة الأعمال،
 * التقديم على الأودشنات وتتبع حالته، وقسم الإنجازات.
 */

/** مطابقة إنجاز بالممثل الحالي: بالبريد أولًا ثم بالاسم. */
function achievementMatchesViewer(achievement: Achievement, viewer: ViewerIdentity): boolean {
  const email = viewer.email.trim().toLowerCase()
  if (email.length > 0 && achievement.actorEmail.trim().toLowerCase() === email) return true
  const name = viewer.name.trim().toLowerCase()
  return name.length > 0 && achievement.actorName.trim().toLowerCase() === name
}

/** الدعوات المعلقة التي وصلت للممثل من الفرق — مع زرّي قبول/رفض. */
function PendingInvites({ viewer }: { viewer: ViewerIdentity }) {
  const workspace = useWorkspace()
  const invites = useMemo(() => pendingInvitesForActor(workspace.productions, viewer), [workspace.productions, viewer])
  if (invites.length === 0) return <p className="text-xs text-muted-foreground">لا توجد دعوات معلقة من الفرق.</p>
  return (
    <div className="space-y-3">
      {invites.map(({ production, member }) => (
        <InviteCard key={production.id + member.id} production={production} member={member} />
      ))}
    </div>
  )
}

function InviteCard({ production, member }: { production: Production; member: CrewMember }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{production.title}</span>
        <StatusBadge tone="amber">{member.part}</StatusBadge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">دعوة للانضمام إلى طاقم هذا العمل (البريد: {member.email}).</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCrewStatus(production.id, member.id, "accepted")}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          قبول
        </button>
        <button
          type="button"
          onClick={() => setCrewStatus(production.id, member.id, "declined")}
          className="rounded-full border border-destructive/60 px-4 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/10"
        >
          رفض
        </button>
      </div>
    </div>
  )
}

/** الأعمال النشطة (فور قبول الدعوة) + أرشيف سابقة الأعمال عند المغادرة. */
function WorksSections({ viewer, avatarUrl }: { viewer: ViewerIdentity; avatarUrl: string }) {
  const workspace = useWorkspace()
  const active = useMemo(() => activeWorksForActor(workspace.productions, viewer), [workspace.productions, viewer])
  const archive = useMemo(() => archivedWorksForActor(workspace.productions, viewer), [workspace.productions, viewer])
  if (active.length === 0 && archive.length === 0) {
    return <p className="text-xs text-muted-foreground">ليس لديك أعمال بعد — اقبل دعوة فرقة ليعمل عملك هنا فورًا.</p>
  }
  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-emerald-200">العروض النشطة</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map(({ production, member }) => (
              <WorkCard key={production.id} production={production} member={member} viewer={viewer} avatarUrl={avatarUrl} />
            ))}
          </div>
        </div>
      )}
      {archive.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">أرشيف سابقة الأعمال</h4>
          <p className="mb-2 text-xs text-muted-foreground">
            أعملك التي غادرت فرقتها — يبقى اسمك محفوظًا على العرض ولا يُحذف.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {archive.map(({ production, member }) => (
              <WorkCard key={production.id} production={production} member={member} archived />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WorkCard({
  production,
  member,
  archived = false,
  viewer,
  avatarUrl = "",
}: {
  production: Production
  member: CrewMember
  archived?: boolean
  viewer?: ViewerIdentity
  avatarUrl?: string
}) {
  return (
    <div className={cn("rounded-xl border p-3", archived ? "border-border/40 bg-background/40" : "border-primary/30 bg-primary/5")}>
      <div className="flex items-start gap-3">
        <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg border border-border/60">
          <Image src={production.posterUrl} alt={production.title} fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{production.title}</p>
          <p className="text-xs text-muted-foreground">{member.part}</p>
          {archived && <StatusBadge tone="gray">مؤرشف</StatusBadge>}
        </div>
      </div>
      {!archived && viewer && (
        <div className="mt-3">
          <SocialShareButton
            label="شارك انضمامك للعرض 🌟"
            className="w-full"
            data={{
              mode: "actor",
              showTitle: production.title,
              posterUrl: production.posterUrl,
              actorName: viewer.name,
              actorImageUrl: avatarUrl,
              roleLabel: member.part,
              venueLabel: production.venue ?? "يحدد لاحقاً",
              footnote: "طاقم كواليس",
            }}
          />
        </div>
      )}
    </div>
  )
}


/** الأودشنات المتاحة: تقديم بضغطة زر + تتبع حالة كل تقديم. */
function AuditionPanel({ viewer, auditions }: { viewer: ViewerIdentity; auditions: PublicAudition[] }) {
  const workspace = useWorkspace()
  const myApplications = useMemo(
    () => workspace.applications.filter((application) => application.actorEmail.trim().toLowerCase() === viewer.email.trim().toLowerCase()),
    [workspace.applications, viewer.email],
  )
  const statusFor = (auditionId: string) => myApplications.find((application) => application.auditionId === auditionId)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const handleApply = (audition: PublicAudition) => {
    applyToAudition({
      auditionId: audition.id,
      actorName: viewer.name.trim() || ACTOR_VIEWER.name,
      actorEmail: viewer.email.trim().toLowerCase() || ACTOR_VIEWER.email,
      profileUrl: `/actors/${encodeURIComponent(viewer.email)}`,
    })
    setSubmittedId(audition.id)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {auditions.map((audition) => {
          const application = statusFor(audition.id)
          return (
            <div key={audition.id} className="flex flex-col rounded-xl border border-border/60 bg-card p-5">
              <div className="flex-1">
                <AuditionCard audition={audition} />
              </div>
              {application ? (
                <div className="mt-3">
                  <StatusBadge tone={APPLICATION_STATUS_TONES[application.status]}>
                    حالة التقديم: {APPLICATION_STATUS_LABELS[application.status]}
                  </StatusBadge>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleApply(audition)}
                  className={cn(
                    "mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
                    submittedId === audition.id && "opacity-60",
                  )}
                >
                  {submittedId === audition.id ? "تم التقديم!" : "تقدّم الآن"}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {myApplications.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h4 className="mb-2 text-sm font-semibold">تتبع تقديماتي</h4>
          <div className="space-y-2">
            {myApplications.map((application) => {
              const audition = workspace.auditions.find((item) => item.id === application.auditionId)
              return (
                <div key={application.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                  <p className="text-sm">{audition?.title ?? application.auditionId}</p>
                  <StatusBadge tone={APPLICATION_STATUS_TONES[application.status]}>
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


/** قسم الإنجازات: قائمة إنجازات الممثل + نموذج إضافة إنجاز جديد. */
function Achievements({ viewer }: { viewer: ViewerIdentity }) {
  const workspace = useWorkspace()
  const achievements = useMemo(
    () => workspace.achievements.filter((achievement) => achievementMatchesViewer(achievement, viewer)),
    [workspace.achievements, viewer],
  )
  return (
    <section className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">إنجازاتي</h3>
      </div>
      <ActorAchievementForm actorName={viewer.name} actorEmail={viewer.email} />
      <div className="mt-4">
        {achievements.length === 0 ? (
          <p className="text-xs text-muted-foreground">لم تسجل أي إنجازات بعد — أضف ورشة أو كورس أو عملًا خارج المنصة.</p>
        ) : (
          <div className="space-y-2">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-2.5">
                <div className="shrink-0 rounded-lg border border-border/60 bg-secondary/40 px-2 py-1 text-[10px] font-semibold">
                  {ACHIEVEMENT_KIND_LABELS[achievement.kind]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {achievement.organizer} — {achievement.year}
                  </p>
                  {achievement.link && (
                    <a href={achievement.link} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      الرابط
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeAchievement(achievement.id)}
                  className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-destructive/10"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** زر تسجيل الخروج يُحدّث الجلسة ويعيد التوجيه. */
function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        signOut()
        window.location.href = "/login"
      }}
      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm transition-colors hover:bg-secondary"
    >
      <LogOut className="h-4 w-4" />
      تسجيل الخروج
    </button>
  )
}

export function ActorDashboardContent({ initialAuditions }: { initialAuditions: PublicAudition[] }) {
  const session = useSession()
  const viewer: ViewerIdentity = session
    ? { name: session.profile.stageName || session.profile.fullName || session.name, email: session.email }
    : ACTOR_VIEWER

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/shows" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowRight className="h-4 w-4" />
        العودة إلى العروض
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <AvatarPicker
            id="actor-avatar"
            label="الصورة الشخصية"
            value={session?.profile.avatarUrl ?? ""}
            onChange={(value) => updateProfile({ avatarUrl: value })}
          />
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">لوحة التحكم</p>
            <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">أهلًا {viewer.name || "ممثل"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{viewer.email}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <main className="space-y-10">
          <section>
            <h2 className="mb-4 text-lg font-semibold">الأودشنات المتاحة</h2>
            <AuditionPanel viewer={viewer} auditions={initialAuditions} />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">أعمالي</h2>
            <WorksSections viewer={viewer} avatarUrl={session?.profile.avatarUrl ?? ""} />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">إنجازاتي</h2>
            <Achievements viewer={viewer} />
          </section>
        </main>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-border/60 bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-primary" />
              الدعوات المعلقة
            </h2>
            <PendingInvites viewer={viewer} />
          </section>
        </aside>
      </div>
    </div>
  )
}

