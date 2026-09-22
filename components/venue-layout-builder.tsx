"use client"

import { useMemo, useState } from "react"
import { Check, Plus, Save, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { rowLabel } from "@/lib/format"
import {
  TEMPLATES,
  addSector,
  applyTemplate,
  confirmVenueLayout,
  layoutCapacity,
  removeSector,
  renameSector,
  sectorCapacity,
  setSectorSize,
  toggleSeat,
  useVenueLayout,
  type VenueSector,
} from "@/lib/venue-layout"

/**
 * مُنشئ تخطيط المسرح الهجين:
 *  1) المرحلة الأولى — اختيار قالب هندسي جاهز بضغطة زر (3 قوالب).
 *  2) المرحلة الثانية — مصفوفة تعديل مباشرة (قطاعات/صفوف/مقاعد + تبديل المقاعد المعطلة).
 *  3) معاينة نهائية بأسلوب مسرحي وزر حفظ وتأكيد.
 */

const FIELD_CLASS = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/* ---------- المرحلة الأولى: القوالب الجاهزة ---------- */

function TemplatePicker({ activeTemplateId }: { activeTemplateId: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">المرحلة الأولى — القوالب الهندسية الجاهزة</h3>
      <p className="mt-1 text-xs text-muted-foreground">اختر هيكلًا مبدئيًا بضغطة زر، ثم خصصه في المصفوفة أدناه.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template.id)}
            className={cn(
              "rounded-xl border p-4 text-right transition-colors",
              activeTemplateId === template.id ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-secondary",
            )}
          >
            <span className="text-2xl">{template.icon}</span>
            <span className="mt-2 block text-sm font-semibold">{template.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{template.description}</span>
            <span className="mt-2 block text-[10px] font-medium text-primary">
              {template.sectors.map((sector) => `${sector.rows}×${sector.seatsPerRow}`).join(" · ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- المرحلة الثانية: مصفوفة القطاعات ---------- */

function SectorMatrix({
  sectors,
  activeSectorId,
  onSelect,
}: {
  sectors: VenueSector[]
  activeSectorId: string | null
  onSelect: (sectorId: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">المرحلة الثانية — مصفوفة التعديل المباشر</h3>
        <button
          type="button"
          onClick={() => addSector()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة قطاع
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-right text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">اسم القطاع</th>
              <th className="px-3 py-2 font-medium">الصفوف (A, B, C…)</th>
              <th className="px-3 py-2 font-medium">مقاعد بالصف</th>
              <th className="px-3 py-2 font-medium">السعة</th>
              <th className="px-3 py-2 font-medium">المعطلة</th>
              <th className="px-3 py-2 font-medium">حذف</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((sector) => (
              <tr
                key={sector.id}
                onClick={() => onSelect(sector.id)}
                className={cn(
                  "cursor-pointer border-b border-border/40 transition-colors",
                  activeSectorId === sector.id ? "bg-primary/10" : "hover:bg-secondary/40",
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={sector.name}
                    onChange={(event) => renameSector(sector.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(FIELD_CLASS, "min-w-36")}
                    aria-label={`اسم القطاع ${sector.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={26}
                    value={sector.rows}
                    onChange={(event) => setSectorSize(sector.id, { rows: Number(event.target.value) })}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(FIELD_CLASS, "w-20")}
                    aria-label={`صفوف ${sector.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={sector.seatsPerRow}
                    onChange={(event) => setSectorSize(sector.id, { seatsPerRow: Number(event.target.value) })}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(FIELD_CLASS, "w-20")}
                    aria-label={`مقاعد بالصف ${sector.name}`}
                  />
                </td>
                <td className="px-3 py-2 font-semibold">{sectorCapacity(sector)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{sector.blockedSeats.length}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    aria-label={`حذف قطاع ${sector.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeSector(sector.id)
                    }}
                    className="rounded-full border border-destructive/50 p-1.5 text-destructive-foreground transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {sectors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  لا قطاعات — أضف قطاعًا أو اختر قالبًا جاهزًا.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


/* ---------- شبكة المقاعد التفاعلية (مبدّل المقاعد المعطلة) ---------- */

function SeatGrid({ sector }: { sector: VenueSector }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{sector.name}</h4>
        <span className="text-xs text-muted-foreground">
          {sector.rows} صفوف × {sector.seatsPerRow} مقعدًا · معطل {sector.blockedSeats.length}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="w-max space-y-1.5">
          {Array.from({ length: sector.rows }, (_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">{rowLabel(rowIndex)}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: sector.seatsPerRow }, (_, seatIndex) => {
                  const seatId = `${rowLabel(rowIndex)}${seatIndex + 1}`
                  const blocked = sector.blockedSeats.includes(seatId)
                  return (
                    <button
                      key={seatId}
                      type="button"
                      title={blocked ? `المقعد ${seatId} معطل (ممر/مكسور)` : `المقعد ${seatId} متاح`}
                      aria-pressed={blocked}
                      aria-label={`المقعد ${seatId}`}
                      onClick={() => toggleSeat(sector.id, seatId)}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[9px] font-semibold transition-colors",
                        blocked
                          ? "border-destructive/50 bg-destructive/15 text-destructive-foreground"
                          : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/25",
                      )}
                    >
                      {blocked ? "✕" : seatIndex + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">اضغط أي كرسي لتبديله بين «متاح» و«معطل/ممر/مكسور».</p>
    </div>
  )
}

/* ---------- المعاينة النهائية ---------- */

function LayoutPreview({ layout }: { layout: ReturnType<typeof useVenueLayout> }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-background/60 p-5">
      <div className="mx-auto mb-4 max-w-md">
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <p className="mt-2 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">المسرح</p>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(layout.sectors.length, 3)}, minmax(0, 1fr))` }}>
        {layout.sectors.map((sector) => (
          <div key={sector.id} className="rounded-lg border border-border/60 bg-card p-3">
            <p className="mb-2 text-center text-xs font-semibold">{sector.name}</p>
            <div className="space-y-1">
              {Array.from({ length: sector.rows }, (_, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-1">
                  {Array.from({ length: sector.seatsPerRow }, (_, seatIndex) => {
                    const seatId = `${rowLabel(rowIndex)}${seatIndex + 1}`
                    const blocked = sector.blockedSeats.includes(seatId)
                    return (
                      <span
                        key={seatId}
                        title={`${sector.name} — ${seatId}`}
                        className={cn(
                          "h-2.5 w-2.5 rounded-sm",
                          blocked ? "bg-destructive/60" : "bg-primary/50",
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/50" /> متاح</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/60" /> معطل</span>
        <span>السعة المتاحة: {layoutCapacity(layout)} مقعدًا</span>
      </div>
    </div>
  )
}


/* ---------- المكون الرئيسي ---------- */

export function VenueLayoutBuilder({ defaultCapacity }: { defaultCapacity: number }) {
  const layout = useVenueLayout()
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const capacity = useMemo(() => layoutCapacity(layout), [layout])
  const activeSector = layout.sectors.find((sector) => sector.id === activeSectorId) ?? layout.sectors[0] ?? null

  const handleConfirm = () => {
    confirmVenueLayout(layout)
    setConfirmed(true)
    window.setTimeout(() => setConfirmed(false), 2500)
  }

  return (
    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
      <TemplatePicker activeTemplateId={layout.templateId} />

      <SectorMatrix sectors={layout.sectors} activeSectorId={activeSector?.id ?? null} onSelect={setActiveSectorId} />

      {activeSector && <SeatGrid sector={activeSector} />}

      <LayoutPreview layout={layout} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          السعة الكلية المتاحة:{" "}
          <span className="font-serif text-base font-bold text-foreground">{capacity}</span> مقعدًا
          <span className="mr-2">(القالب الأساسي للقاعة: {defaultCapacity} مقعدًا)</span>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {confirmed ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {confirmed ? "تم تأكيد المخطط!" : "حفظ وتأكيد المخطط"}
        </button>
      </div>
      {confirmed && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          تم حفظ تخطيط المسرح وتأكيده — الكروت والمعاينة أعلاه مُحدَّثة بالسعة الجديدة.
        </p>
      )}
    </div>
  )
}

