"use client"

import { useState } from "react"
import { Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACHIEVEMENT_KIND_LABELS, addAchievement, type AchievementKind } from "@/lib/productions"

/**
 * نموذج إضافة إنجاز جديد للممثل: ورشة مسرحية، كورس، أو عمل خارج المنصة.
 * يُحفظ في مساحة العمل ويظهر مباشرة في قسم «إنجازاتي» بلوحة الممثل.
 */

const FIELD_CLASS = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

export type ActorAchievementFormProps = {
  actorName: string
  actorEmail: string
  onSaved?: () => void
  className?: string
}

type AchievementDraft = {
  kind: AchievementKind
  title: string
  organizer: string
  year: string
  link: string
}

const EMPTY_DRAFT: AchievementDraft = {
  kind: "workshop",
  title: "",
  organizer: "",
  year: String(new Date().getFullYear()),
  link: "",
}

export function ActorAchievementForm({ actorName, actorEmail, onSaved, className }: ActorAchievementFormProps) {
  const [form, setForm] = useState<AchievementDraft>(EMPTY_DRAFT)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(false)

  const update = (field: keyof AchievementDraft, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const submit = () => {
    if (form.title.trim().length < 2) {
      setNotice({ ok: false, text: "اسم الإنجاز مطلوب." })
      return
    }
    if (!/^\d{4}$/.test(form.year.trim())) {
      setNotice({ ok: false, text: "أدخل سنة صحيحة (مثال: 2026)." })
      return
    }
    addAchievement({
      actorName: actorName.trim(),
      actorEmail: actorEmail.trim().toLowerCase(),
      kind: form.kind,
      title: form.title.trim(),
      organizer: form.organizer.trim(),
      year: form.year.trim(),
      link: form.link.trim(),
    })
    setNotice({ ok: true, text: `تم حفظ الإنجاز «${form.title.trim()}».` })
    setForm(EMPTY_DRAFT)
    setOpen(false)
    onSaved?.()
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Award className="h-3.5 w-3.5" />
          إضافة إنجاز جديد
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              نوع الإنجاز
              <select value={form.kind} onChange={(event) => update("kind", event.target.value)} className={cn(FIELD_CLASS, "mt-1")}>
                {Object.entries(ACHIEVEMENT_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              اسم الإنجاز *
              <input type="text" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="مثال: ورشة ارتجال متقدم" className={cn(FIELD_CLASS, "mt-1")} />
            </label>
            <label className="text-xs text-muted-foreground">
              المنظم / المؤسسة
              <input type="text" value={form.organizer} onChange={(event) => update("organizer", event.target.value)} placeholder="مثال: ساقية الصاوي" className={cn(FIELD_CLASS, "mt-1")} />
            </label>
            <label className="text-xs text-muted-foreground">
              السنة *
              <input type="text" inputMode="numeric" value={form.year} onChange={(event) => update("year", event.target.value)} placeholder="2026" className={cn(FIELD_CLASS, "mt-1")} />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            رابط (اختياري)
            <input type="url" value={form.link} onChange={(event) => update("link", event.target.value)} placeholder="https://…" className={cn(FIELD_CLASS, "mt-1")} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              حفظ الإنجاز
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setNotice(null)
                setForm(EMPTY_DRAFT)
              }}
              className="rounded-full border border-border/60 px-4 py-2 text-xs transition-colors hover:bg-secondary"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-lg border p-3 text-xs",
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground",
          )}
        >
          {notice.text}
        </p>
      )}
    </div>
  )
}
