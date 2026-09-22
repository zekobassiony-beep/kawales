"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import { SHOW_STATUS_LABELS, createProduction, updateProduction, useWorkspace, type Production } from "@/lib/productions"
import { INPUT_CLASS, PosterField, StepPill, showStatusTone, type StepTwoDraft } from "./wizard-fields"
import { GalleryEditor, InviteSystem, SeatingModeField, StepTwoSummary, TiersEditor, VenueField } from "./wizard-step-two"

/**
 * نموذج إضافة عمل مسرحي من خطوتين:
 *  - الخطوة 1 (إجبارية): اسم العرض + البوستر — ويُنشر فورًا بحالة «قريبًا».
 *  - الخطوة 2 (اختيارية): المسرح، فئات التذاكر، نمط الحجز، معرض الصور، والدعوات.
 */

export function ShowWizard({
  venueOptions,
  editingId,
  onClose,
}: {
  venueOptions: string[]
  editingId: string | null
  onClose: () => void
}) {
  const workspace = useWorkspace()
  const [step, setStep] = useState<1 | 2>(1)
  const [draftProduction, setDraftProduction] = useState<Production | null>(null)
  const [title, setTitle] = useState("")
  const [posterUrl, setPosterUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  /* وضع التعديل: نفتح الخطوة الثانية مباشرة على عرض موجود. */
  useEffect(() => {
    if (editingId) {
      const existing = workspace.productions.find((production) => production.id === editingId) ?? null
      setDraftProduction(existing)
      setTitle(existing?.title ?? "")
      setPosterUrl(existing?.posterUrl ?? "")
      setStep(existing ? 2 : 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const draft = useMemo<StepTwoDraft>(
    () => ({
      venue: draftProduction?.venue ?? null,
      tiers: draftProduction?.tiers ?? [],
      seatingMode: draftProduction?.seatingMode ?? "numbered",
      rows: draftProduction?.rows ?? 6,
      seatsPerRow: draftProduction?.seatsPerRow ?? 10,
      blockedSeats: draftProduction?.blockedSeats ?? [],
      capacity: draftProduction?.capacity ?? 0,
      sold: draftProduction?.sold ?? 0,
      gallery: draftProduction?.gallery ?? [],
    }),
    [draftProduction],
  )

  const patchDraft = (patch: Partial<StepTwoDraft>) => {
    if (!draftProduction) return
    updateProduction(draftProduction.id, patch)
  }

  const publish = () => {
    if (title.trim().length < 2) {
      setError("اسم العرض مطلوب (حرفان على الأقل).")
      return
    }
    if (!posterUrl) {
      setError("بوستر العرض مطلوب — ارفع صورة للنشر.")
      return
    }
    setError(null)
    const created = createProduction({ title, posterUrl })
    setDraftProduction(created)
    setStep(2)
  }

  const saveAndClose = () => onClose()

  /* وضع التعديل لعرض غير موجود: لا نعرض شيئًا. */
  if (editingId && !draftProduction) return null

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            {editingId ? "تعديل العمل المسرحي" : "إضافة عمل مسرحي جديد"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            الخطوة الأولى تنشر العرض فورًا بحالة «قريبًا / Coming Soon» — وبقية التفاصيل اختيارية وتُكمل لاحقًا.
          </p>
        </div>
        <button
          type="button"
          aria-label="إغلاق النموذج"
          onClick={saveAndClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StepPill index={1} label="الاسم والبوستر" active={step === 1} done={step > 1} />
        <StepPill index={2} label="التفاصيل (اختياري)" active={step === 2} done={false} />
      </div>

      {draftProduction && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>حالة النشر الحالية:</span>
          <StatusBadge tone={showStatusTone(draftProduction.status)}>{SHOW_STATUS_LABELS[draftProduction.status]}</StatusBadge>
        </div>
      )}

      {step === 1 ? (
        <div className="mt-5 max-w-xl space-y-4">
          <div>
            <label htmlFor="wizard-title" className="block text-xs text-muted-foreground">
              اسم العرض *
            </label>
            <input
              id="wizard-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: ليلة في القهوة"
              className={cn(INPUT_CLASS, "mt-1")}
            />
          </div>
          <div>
            <label htmlFor="wizard-poster" className="block text-xs text-muted-foreground">
              بوستر العرض *
            </label>
            <PosterField url={posterUrl} onChange={setPosterUrl} label="بوستر العرض" icon={<Sparkles className="h-4 w-4" />} />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={publish}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            نشر العرض الآن (قريبًا)
          </button>
        </div>
      ) : (
        draftProduction && (
          <div className="mt-5 space-y-6">
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              تم نشر «{draftProduction.title}» بحالة قريبًا. أكمل التفاصيل التالية متى توفرت — كلها قابلة للتعديل لاحقًا.
            </p>
            <StepTwoSummary production={draftProduction} />
            <VenueField draft={draft} onChange={patchDraft} />
            {venueOptions.length > 0 && (
              <p className="text-xs text-muted-foreground">مسارح متاحة على المنصة: {venueOptions.join("، ")}</p>
            )}
            <TiersEditor tiers={draft.tiers} onChange={(tiers) => patchDraft({ tiers })} />
            <SeatingModeField draft={draft} onChange={patchDraft} />
            <GalleryEditor gallery={draft.gallery} onChange={(gallery) => patchDraft({ gallery })} />
            <InviteSystem production={draftProduction} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveAndClose}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                حفظ وإغلاق
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-border/60 px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                رجوع للخطوة الأولى
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
