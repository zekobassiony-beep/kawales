"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Rocket, Save, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import { notify } from "@/lib/toast"
import { publishProductionToCatalogue } from "@/app/actions/catalogue"
import { isServerProductionId, waitForPublishedId } from "@/lib/productions-sync"
import { SHOW_STATUS_LABELS, createProduction, updateProduction, useWorkspace } from "@/lib/productions"
import { INPUT_CLASS, PosterField, showStatusTone, type StepTwoDraft } from "./wizard-fields"
import {
  GalleryEditor,
  InviteSystem,
  ScheduleField,
  SeatingModeField,
  StepTwoSummary,
  TiersEditor,
  VenueField,
} from "./wizard-step-two"

/**
 * نموذج إضافة/تعديل العمل المسرحي — **نافذة واحدة بكل الحقول**.
 *
 * كان النموذج خطوتين: تُنشئ العمل بحالة «قريبًا»، ثم تنزل إلى «أعمالك في مساحة
 * العمل» وتضغط «تعديل» وترجع لأعلى لإكمال التفاصيل. الآن كل الحقول (الاسم ·
 * البوستر · المسرح · الفئات · نمط الحجز · المواعيد · المعرض · الطاقم) في نافذة
 * واحدة، مع زرّي «حفظ ونشر» (عرض فعلي) و«حفظ كمسودة».
 */

/** هل المعرّف صادر من قاعدة البيانات (UUID) أم معرّف محلي مؤقت؟ */
const isServerId = isServerProductionId

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
  const router = useRouter()
  /**
   * نحتفظ بمعرّف العمل فقط ونشتق العمل الحيّ من المخزن — حتى تظهر كل ضغطة
   * (مسرح/فئات/نمط حجز/مواعيد/معرض/دعوات) فورًا بلا أي حالة قديمة.
   */
  const [draftId, setDraftId] = useState<string | null>(editingId)
  const [title, setTitle] = useState("")
  const [posterUrl, setPosterUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const draftProduction = useMemo(
    () => (draftId ? (workspace.productions.find((production) => production.id === draftId) ?? null) : null),
    [workspace.productions, draftId],
  )

  /* وضع التعديل: نفتح النافذة على عرض موجود مباشرة. */
  useEffect(() => {
    if (!editingId) return
    setDraftId(editingId)
    const existing = workspace.productions.find((production) => production.id === editingId)
    if (existing) {
      setTitle(existing.title)
      setPosterUrl(existing.posterUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  const draft = useMemo<StepTwoDraft>(
    () => ({
      venue: draftProduction?.venue ?? null,
      venueKind: draftProduction?.venueKind ?? "later",
      venueCity: draftProduction?.venueCity ?? "",
      tiers: draftProduction?.tiers ?? [],
      seatingMode: draftProduction?.seatingMode ?? "numbered",
      rows: draftProduction?.rows ?? 6,
      seatsPerRow: draftProduction?.seatsPerRow ?? 10,
      blockedSeats: draftProduction?.blockedSeats ?? [],
      capacity: draftProduction?.capacity ?? 0,
      sold: draftProduction?.sold ?? 0,
      gallery: draftProduction?.gallery ?? [],
      startsAt: draftProduction?.startsAt ?? "",
      showtimes: draftProduction?.showtimes ?? [],
    }),
    [draftProduction],
  )

  /** يحدّث حقلًا في المسودة محليًا — والمزامنة ترفعه لقاعدة البيانات تلقائيًا. */
  const patchDraft = (patch: Partial<StepTwoDraft>) => {
    if (!draftProduction) return
    updateProduction(draftProduction.id, patch)
  }

  /** يضمن وجود صف للعمل (يُنشئ مسودة عند الحاجة) — أساس الحفظ في خطوة واحدة. */
  const ensureDraft = (): string | null => {
    if (draftProduction) return draftProduction.id
    if (title.trim().length < 2) {
      setError("اكتب اسم العرض أولًا (حرفان على الأقل).")
      return null
    }
    const created = createProduction({ title, posterUrl })
    setDraftId(created.id)
    return created.id
  }

  /** حفظ كمسودة (حالة «قريبًا») ثم إغلاق. */
  const saveAsDraft = () => {
    const id = ensureDraft()
    if (!id) return
    updateProduction(id, { status: "coming_soon" })
    notify(`حُفظ «${title}» كمسودة (قريبًا) — يمكنك النشر لاحقًا بضغطة واحدة ✓`, "success")
    onClose()
  }

  /** نشر العرض كعرض **فعلي** (معروض للبيع) بتحقق كامل + إدراجه في كتالوج المنصة. */
  const publishNow = async () => {
    const id = ensureDraft()
    if (!id) return

    const missing: string[] = []
    if (posterUrl.trim().length === 0) missing.push("البوستر")
    if ((draft.venue ?? "").trim().length === 0) missing.push("مكان العرض")
    if (draft.tiers.length === 0) missing.push("فئة سعر واحدة على الأقل")
    if (draft.seatingMode === "numbered" ? !(draft.rows > 0 && draft.seatsPerRow > 0) : !(draft.capacity > 0)) {
      missing.push("تفاصيل المقاعد/السعة")
    }
    if ((draft.startsAt ?? "").trim().length === 0) missing.push("الموعد الأساسي")

    if (missing.length > 0) {
      setError(`لإتمام النشر أكمل: ${missing.join(" · ")}`)
      return
    }

    setError(null)
    setSaving(true)
    const showtimes = Array.from(
      new Set(
        [draft.startsAt as string, ...(draft.showtimes ?? [])].filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        ),
      ),
    )
    updateProduction(id, { status: "on_sale", startsAt: draft.startsAt, showtimes })

    // النشر العام: يُدرج العرض في كتالوج المنصة (الرئيسية + /shows + صفحة العرض)
    // فيصبح قابلًا للتصفح والحجز مثل أي عرض آخر.
    const serverId = isServerId(id) ? id : await waitForPublishedId(title)
    const published = serverId
      ? await publishProductionToCatalogue(serverId)
      : { ok: false, error: "لم تُحفظ المسودة على السيرفر بعد — أعد المحاولة بعد لحظة." }

    if (published.ok) {
      notify(`نُشر «${title}» وأصبح معروضًا للجمهور وقابلًا للحجز ✓ — تجده في «العروض القادمة»`, "success", 8000)
    } else {
      notify(published.error ?? "حُفظ العرض في حسابك، لكن تعذّر عرضه في الكتالوج العام.", "error", 10000)
    }

    setSaving(false)
    router.refresh()
    onClose()
  }

  /* وضع التعديل قبل جهوزية مساحة العمل: رسالة بدل نافذة فارغة صامتة. */
  if (editingId && !draftProduction) {
    return (
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
        جارٍ تحميل بيانات العمل المسرحي… إن استمرت الرسالة، أعد تحديث الصفحة.
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-background/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
        {/* ترويسة ثابتة: العنوان وحالة النشر يبقيان في المقدمة أثناء التمرير */}
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-card/95 p-5 backdrop-blur">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingId ? "تعديل العمل المسرحي" : "إضافة عمل مسرحي جديد"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              كل التفاصيل في نافذة واحدة — املأ ما تريد ثم اختر «حفظ ونشر» ليظهر العرض معروضًا للبيع فورًا.
            </p>
            {draftProduction && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                حالة النشر الحالية:
                <StatusBadge tone={showStatusTone(draftProduction.status)}>
                  {SHOW_STATUS_LABELS[draftProduction.status]}
                </StatusBadge>
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="إغلاق النموذج"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* SENDS_SECTIONS_PLACEHOLDER */}

        {/* كل الحقول في مرة واحدة — بلا خطوات ولا نزول إلى مساحة العمل */}
        <div className="max-h-[68vh] space-y-7 overflow-y-auto p-5">
          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">الأساسيات</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                اسم العرض *
                <input
                  id="wizard-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="مثال: ليلة في القهوة"
                  className={cn(INPUT_CLASS, "mt-1")}
                />
              </label>
              <div>
                <span className="block text-xs text-muted-foreground">بوستر العرض *</span>
                <PosterField
                  url={posterUrl}
                  onChange={setPosterUrl}
                  label="بوستر العرض"
                  icon={<Sparkles className="h-4 w-4" />}
                />
              </div>
            </div>
          </section>

          {draftProduction && (
            <section className="space-y-3">
              <h3 className="font-serif text-base font-semibold">اكتمال الملف</h3>
              <StepTwoSummary production={draftProduction} />
            </section>
          )}

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">مكان العرض</h3>
            <VenueField draft={draft} onChange={patchDraft} suggestions={venueOptions} />
          </section>

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">الفئات والأسعار</h3>
            <TiersEditor tiers={draft.tiers} onChange={(tiers) => patchDraft({ tiers })} />
          </section>

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">طريقة الحجز</h3>
            <SeatingModeField draft={draft} onChange={patchDraft} />
          </section>

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">المواعيد</h3>
            <ScheduleField draft={draft} onChange={patchDraft} />
          </section>

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">الصور الترويجية</h3>
            <GalleryEditor gallery={draft.gallery} onChange={(gallery) => patchDraft({ gallery })} />
          </section>

          <section className="space-y-4">
            <h3 className="font-serif text-base font-semibold">طاقم العمل</h3>
            {draftProduction && isServerId(draftProduction.id) ? (
              <InviteSystem production={draftProduction} />
            ) : (
              <p className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                الدعوات تُتاح بعد أول حفظ للعمل: اضغط «حفظ كمسودة» ثم افتح «تعديل»، أو أكمل التفاصيل واضغط «حفظ ونشر».
              </p>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive-foreground"
            >
              {error}
            </p>
          )}
        </div>

        {/* شريط الأزرار ثابت أسفل النافذة */}
        <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border/60 bg-card/95 p-4 backdrop-blur">
          <button
            type="button"
            onClick={() => void publishNow()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            حفظ ونشر (عرض فعلي)
          </button>
          <button
            type="button"
            onClick={saveAsDraft}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            حفظ كمسودة (قريبًا)
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            يُحفظ في حسابك تلقائيًا مع كل تعديل
          </span>
        </footer>
      </div>
    </div>
  )
}
