"use client"

import { useState } from "react"
import { BadgeCheck, ShieldCheck, ShieldOff, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  BADGE_KIND_LABELS,
  BADGE_LEVEL_LABELS,
  badgeStats,
  grantBadge,
  revokeBadge,
  setBadgeLevel,
  useVerifiedEntities,
  type VerifiedBadgeLevel,
  type VerifiedEntityKind,
} from "@/lib/badges"

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/** قسم منح/سحب التوثيق (ذهبي/أزرق) للممثلين والفرق والمسارح. */
export function BadgeCenter() {
  const entities = useVerifiedEntities()
  const stats = badgeStats(entities)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<VerifiedEntityKind>("actor")
  const [level, setLevel] = useState<VerifiedBadgeLevel>("gold")
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          مركز التوثيق (Verified Badges)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          امنح الشارة الذهبية أو الزرقاء للممثلين والفرق المعتمدة، أو اسحبها فورًا.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "كيانات موثقة", value: String(stats.total) },
          { label: "توثيق ذهبي", value: String(stats.gold) },
          { label: "توثيق أزرق", value: String(stats.blue) },
          { label: "ممثلون / فرق", value: `${stats.actors} / ${stats.troupes}` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className="font-serif text-xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/40 bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted-foreground sm:col-span-2">
            اسم الممثل / الفرقة / المسرح
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: كريم عادل"
              className={cn(FIELD, "mt-1")}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            النوع
            <select value={kind} onChange={(event) => setKind(event.target.value as VerifiedEntityKind)} className={cn(FIELD, "mt-1")}>
              {(Object.keys(BADGE_KIND_LABELS) as VerifiedEntityKind[]).map((value) => (
                <option key={value} value={value}>
                  {BADGE_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            المستوى
            <select value={level} onChange={(event) => setLevel(event.target.value as VerifiedBadgeLevel)} className={cn(FIELD, "mt-1")}>
              {(Object.keys(BADGE_LEVEL_LABELS) as VerifiedBadgeLevel[]).map((value) => (
                <option key={value} value={value}>
                  {BADGE_LEVEL_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            const entity = grantBadge({ name, kind, level })
            setNotice(entity ? `تم منح ${BADGE_LEVEL_LABELS[level]} إلى «${entity.name}».` : "أدخل اسمًا صحيحًا.")
            if (entity) setName("")
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          منح الشارة
        </button>
        {notice && (
          <p role="status" className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {notice}
          </p>
        )}
      </div>

      <BadgeList onNotice={setNotice} />
    </div>
  )

/** قائمة الكيانات الموثقة مع تبديل المستوى وسحب التوثيق. */
function BadgeList({ onNotice }: { onNotice: (text: string) => void }) {
  const entities = useVerifiedEntities()

  if (entities.length === 0) {
    return <p className="rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">لا كيانات موثقة بعد.</p>
  }

  return (
    <div className="space-y-2">
      {entities.map((entity) => (
        <div key={entity.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-3">
            <BadgeCheck className={cn("h-5 w-5", entity.level === "gold" ? "text-amber-400" : "text-sky-400")} />
            <div>
              <p className="text-sm font-semibold">{entity.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {BADGE_KIND_LABELS[entity.kind]} · مُنحت في {new Date(entity.grantedAt).toLocaleDateString("ar-EG")}
                {entity.note ? ` · ${entity.note}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={entity.level === "gold" ? "amber" : "gray"}>{BADGE_LEVEL_LABELS[entity.level]}</StatusBadge>
            <button
              type="button"
              onClick={() => {
                const next: VerifiedBadgeLevel = entity.level === "gold" ? "blue" : "gold"
                setBadgeLevel(entity.id, next)
                onNotice(`تم تحويل «${entity.name}» إلى ${BADGE_LEVEL_LABELS[next]}.`)
              }}
              className="rounded-full border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
            >
              تبديل المستوى
            </button>
            <button
              type="button"
              onClick={() => {
                revokeBadge(entity.id)
                onNotice(`تم سحب التوثيق من «${entity.name}».`)
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-xs text-destructive-foreground transition-colors hover:bg-destructive/10"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              سحب التوثيق
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

}
