"use client"

import { useMemo, useState } from "react"
import { ImagePlus, Search, Send, Ticket, Trash2, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  CREW_PARTS,
  CREW_STATUS_LABELS,
  DEFAULT_TIERS,
  INVITE_DIRECTORY,
  LATER_VENUE_LABEL,
  SEATING_MODE_LABELS,
  TIER_COLOR_PRESETS,
  cancelCrewInvite,
  inviteCrewMember,
  seatLabels,
  setCrewStatus,
  stepTwoChecklist,
  type CrewMember,
  type Production,
  type SeatingMode,
  type TicketTier,
} from "@/lib/productions"
import { INPUT_CLASS, useFilePicker, IMAGE_ACCEPT, type StepTwoDraft } from "./wizard-fields"

/**
 * الخطوة الثانية (اختيارية) من نموذج العمل المسرحي: المسرح، فئات التذاكر،
 * نمط الحجز، معرض الصور، ونظام الدعوات — كلها قابلة للتعديل لاحقًا.
 */

/* ---------- المسرح ---------- */

export function VenueField({ draft, onChange }: { draft: StepTwoDraft; onChange: (patch: Partial<StepTwoDraft>) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground">مكان العرض</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {["مسرح الهوسابير", "ساقية الصاوي", "مسرح الطليعة"].map((venue) => (
          <button
            key={venue}
            type="button"
            onClick={() => onChange({ venue })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              draft.venue === venue
                ? "border-primary/60 bg-primary/10 text-primary-foreground"
                : "border-border/60 text-muted-foreground hover:bg-secondary",
            )}
          >
            {venue}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ venue: null })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            draft.venue === null
              ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
              : "border-border/60 text-muted-foreground hover:bg-secondary",
          )}
        >
          {LATER_VENUE_LABEL}
        </button>
      </div>
    </div>
  )
}

/* ---------- فئات التذاكر ---------- */

/* ---------- فئات التذاكر المخصّصة (الاسم/السعر/اللون/نطاق الصفوف) ---------- */

/** يستخرج نطاق الصفوف المعروض (1-based) من فئة. */
function tierRange(rows: number[]): { from: number; to: number } {
  if (rows.length === 0) return { from: 1, to: 1 }
  const sorted = [...rows].sort((a, b) => a - b)
  return { from: sorted[0] + 1, to: sorted[sorted.length - 1] + 1 }
}

/** يبني فهارس الصفوف (0-based) من نطاق مُدخل (1-based). */
function rowsFromRange(from: number, to: number): number[] {
  const start = Math.max(1, Math.min(from, to))
  const end = Math.max(1, Math.max(from, to))
  const rows: number[] = []
  for (let index = start; index <= Math.min(end, 26); index += 1) rows.push(index - 1)
  return rows
}

export function TiersEditor({ tiers, onChange }: { tiers: TicketTier[]; onChange: (tiers: TicketTier[]) => void }) {
  const updateTier = (id: string, patch: Partial<TicketTier>) =>
    onChange(tiers.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)))

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">
          فئات المقاعد وأسعارها (الاسم · السعر · اللون · نطاق الصفوف)
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          تُحفظ هذه الفئات مع العرض وتقرأها خريطة المقاعد ومحرك الحجز تلقائيًا في صفحة الحجز.
        </p>
      </div>

      {tiers.length === 0 && <p className="text-xs text-muted-foreground">لا توجد فئات بعد — أضف فئة أو استرجع الافتراضي.</p>}

      {tiers.map((tier) => {
        const range = tierRange(tier.rows)
        return (
          <div key={tier.id} className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-5 w-5 shrink-0 rounded-md border border-border/60" style={{ backgroundColor: tier.color }} />
              <input
                type="text"
                value={tier.name}
                onChange={(event) => updateTier(tier.id, { name: event.target.value })}
                className={cn(INPUT_CLASS, "w-28")}
                aria-label="اسم الفئة"
              />
              <input
                type="number"
                min={0}
                value={tier.priceEgp}
                onChange={(event) => updateTier(tier.id, { priceEgp: Number(event.target.value) || 0 })}
                className={cn(INPUT_CLASS, "w-24")}
                aria-label="السعر (ج.م)"
              />
              <span className="text-xs text-muted-foreground">ج.م</span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                من صف
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={range.from}
                  onChange={(event) => updateTier(tier.id, { rows: rowsFromRange(Number(event.target.value) || 1, range.to) })}
                  className={cn(INPUT_CLASS, "w-16")}
                  aria-label="من صف"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                إلى صف
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={range.to}
                  onChange={(event) => updateTier(tier.id, { rows: rowsFromRange(range.from, Number(event.target.value) || 1) })}
                  className={cn(INPUT_CLASS, "w-16")}
                  aria-label="إلى صف"
                />
              </label>
              <button
                type="button"
                aria-label={`حذف فئة ${tier.name}`}
                onClick={() => onChange(tiers.filter((item) => item.id !== tier.id))}
                className="ms-auto rounded-full border border-destructive/50 p-1.5 text-destructive-foreground transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <TierColorPicker value={tier.color} onChange={(color) => updateTier(tier.id, { color })} />
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...tiers,
              { id: `tier-${Date.now()}`, name: "فئة جديدة", priceEgp: 100, capacity: 40, color: "#3b82f6", rows: [] },
            ])
          }
          className="rounded-full border border-border/60 px-3 py-1 text-xs transition-colors hover:bg-secondary"
        >
          + إضافة فئة
        </button>
        {tiers.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_TIERS)}
            className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            استرجاع الافتراضي (VIP / صالة / بلكون)
          </button>
        )}
      </div>
    </div>
  )
}

/** منتقي لون الفئة: ألوان جاهزة + لون مخصص. */
function TierColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">اللون:</span>
      {TIER_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.color}
          type="button"
          aria-label={preset.label}
          title={preset.label}
          onClick={() => onChange(preset.color)}
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
            value === preset.color ? "border-foreground" : "border-transparent",
          )}
          style={{ backgroundColor: preset.color }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="لون مخصص"
        className="h-6 w-8 cursor-pointer rounded border border-border/60 bg-transparent"
      />
    </div>
  )
}

/* ---------- نمط الحجز ---------- */

export function SeatingModeField({ draft, onChange }: { draft: StepTwoDraft; onChange: (patch: Partial<StepTwoDraft>) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground">نمط الحجز</label>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {(["numbered", "general_admission"] as SeatingMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ seatingMode: mode })}
            className={cn(
              "rounded-lg border p-3 text-right text-xs transition-colors",
              draft.seatingMode === mode ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-secondary",
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Ticket className="h-4 w-4" />
              {SEATING_MODE_LABELS[mode]}
            </span>
            <span className="mt-1 block text-muted-foreground">
              {mode === "numbered" ? "يختار الجمهور كرسيًا محددًا من خريطة القاعة." : "يحجز الجمهور فئة تذكرة بلا رقم كرسي."}
            </span>
          </button>
        ))}
      </div>
      {draft.seatingMode === "numbered" ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            الصفوف
            <input
              type="number"
              min={1}
              max={26}
              value={draft.rows}
              onChange={(event) => onChange({ rows: Math.min(26, Math.max(1, Number(event.target.value) || 1)) })}
              className={cn(INPUT_CLASS, "mt-1 w-20")}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            المقاعد لكل صف
            <input
              type="number"
              min={1}
              max={40}
              value={draft.seatsPerRow}
              onChange={(event) => onChange({ seatsPerRow: Math.min(40, Math.max(1, Number(event.target.value) || 1)) })}
              className={cn(INPUT_CLASS, "mt-1 w-20")}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            معاينة: {seatLabels({ rows: draft.rows, seatsPerRow: draft.seatsPerRow }).slice(0, 6).join("، ")}…
          </p>
        </div>
      ) : (
        <label className="mt-2 block text-xs text-muted-foreground">
          سعة القاعة (تذكرة)
          <input
            type="number"
            min={0}
            value={draft.capacity}
            onChange={(event) => onChange({ capacity: Math.max(0, Number(event.target.value) || 0) })}
            className={cn(INPUT_CLASS, "mt-1 w-28")}
          />
        </label>
      )}
    </div>
  )
}

/* ---------- معرض الصور الدعائية ---------- */

export function GalleryEditor({ gallery, onChange }: { gallery: string[]; onChange: (gallery: string[]) => void }) {
  const { inputRef, onPickFile } = useFilePicker((url) => onChange([...gallery, url]))
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <ImagePlus className="h-3.5 w-3.5" />
        معرض الصور الدعائية
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {gallery.map((url, index) => (
          <div key={url + index} className="relative h-20 w-28 overflow-hidden rounded-lg border border-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`صورة دعائية ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="إزالة الصورة"
              onClick={() => onChange(gallery.filter((_, i) => i !== index))}
              className="absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:bg-destructive/20"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:bg-secondary"
        >
          + إضافة صورة
        </button>
        <input type="file" ref={inputRef} accept={IMAGE_ACCEPT} onChange={onPickFile} className="hidden" />
      </div>
    </div>
  )
}

/* ---------- نظام الدعوات وطاقم العمل ---------- */

export function InviteSystem({ production }: { production: Production }) {
  const [query, setQuery] = useState("")
  const [part, setPart] = useState<string>(CREW_PARTS[0])
  const invitedEmails = new Set(production.crew.map((member) => member.email))
  const results = useMemo(() => {
    const term = query.trim()
    if (term.length === 0) return INVITE_DIRECTORY.slice(0, 3)
    return INVITE_DIRECTORY.filter(
      (person) => person.name.includes(term) || person.specialty.includes(term) || person.email.includes(term),
    )
  }, [query])

  const invite = (name: string, email: string) => {
    inviteCrewMember(production.id, { name, email, part })
    setQuery("")
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        دعوة طاقم العمل — ابحث بالاسم وأرسل دعوة انضمام
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن ممثل بالاسم…"
            className={cn(INPUT_CLASS, "pr-8")}
          />
        </div>
        <select value={part} onChange={(event) => setPart(event.target.value)} className={cn(INPUT_CLASS, "w-32 text-sm")}>
          {CREW_PARTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {results.map((person) => (
          <div key={person.email} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.specialty}</p>
            </div>
            {invitedEmails.has(person.email) ? (
              <StatusBadge tone="amber">تمت الدعوة</StatusBadge>
            ) : (
              <button
                type="button"
                onClick={() => invite(person.name, person.email)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Send className="h-3 w-3" />
                إرسال دعوة
              </button>
            )}
          </div>
        ))}
        {results.length === 0 && <p className="text-xs text-muted-foreground">لا نتائج مطابقة لبحثك.</p>}
      </div>
      <CrewList production={production} />
    </div>
  )
}

export function CrewList({ production }: { production: Production }) {
  if (production.crew.length === 0) {
    return <p className="text-xs text-muted-foreground">لا طاقم مدعوًا بعد لهذا العرض.</p>
  }
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">طاقم العمل</label>
      {production.crew.map((member) => (
        <CrewRow key={member.id} productionId={production.id} member={member} />
      ))}
    </div>
  )
}

function CrewRow({ productionId, member }: { productionId: string; member: CrewMember }) {
  const tone = member.status === "accepted" ? "green" : member.status === "invited" ? "amber" : "gray"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {member.name} <span className="text-xs text-muted-foreground">({member.part})</span>
        </p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {member.email}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge tone={tone}>{CREW_STATUS_LABELS[member.status]}</StatusBadge>
        {member.status === "invited" ? (
          <button
            type="button"
            aria-label="إلغاء الدعوة"
            onClick={() => cancelCrewInvite(productionId, member.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : member.status === "accepted" ? (
          <button
            type="button"
            onClick={() => setCrewStatus(productionId, member.id, "removed")}
            className="inline-flex items-center gap-1 rounded-full border border-destructive/50 px-2.5 py-1 text-xs text-destructive-foreground transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
            استبعاد
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- ملخص الخطوة الثانية ---------- */

export function StepTwoSummary({ production }: { production: Production }) {
  const checklist = stepTwoChecklist(production)
  return (
    <div className="flex flex-wrap gap-2">
      {checklist.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
            item.done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-border/60 text-muted-foreground",
          )}
        >
          {item.done ? "✓" : "○"} {item.label}
        </span>
      ))}
    </div>
  )
}
