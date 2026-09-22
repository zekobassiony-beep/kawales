"use client"

import { useState } from "react"
import { Megaphone, Power } from "lucide-react"
import { cn } from "@/lib/utils"
import { FLASH_TONES, toggleFlashBanner, updateFlashBanner, useFlashBanner, type FlashBannerTone } from "@/lib/flash-banner"

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/** نشرة التنبيهات العاجلة: إظهار/إخفاء شريط أعلى الموقع وتعديل نصه ولونه. */
export function FlashBannerEditor() {
  const banner = useFlashBanner()
  const [draft, setDraft] = useState({ text: banner.text, tone: banner.tone, linkUrl: banner.linkUrl ?? "", linkLabel: banner.linkLabel ?? "" })
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Megaphone className="h-5 w-5 text-primary" />
          نشرة التنبيهات العاجلة (Flash Banner)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          شريط يظهر أعلى كل صفحات الموقع فور التفعيل — يُستخدم للعروض العاجلة أو تنبيهات تغيير المواعيد.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card p-4">
        <button
          type="button"
          onClick={() => {
            toggleFlashBanner()
            setNotice(banner.enabled ? "تم إخفاء الشريط من الموقع." : "تم إظهار الشريط أعلى الموقع.")
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-opacity hover:opacity-90",
            banner.enabled ? "bg-destructive/80 text-white" : "bg-emerald-600 text-white",
          )}
        >
          <Power className="h-3.5 w-3.5" />
          {banner.enabled ? "إخفاء الشريط الآن" : "إظهار الشريط الآن"}
        </button>
        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", banner.enabled ? "bg-emerald-500/20 text-emerald-200" : "bg-secondary/40 text-muted-foreground")}>
          الحالة: {banner.enabled ? "ظاهر للجمهور" : "مخفي"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          آخر تعديل: {new Date(banner.updatedAt).toLocaleString("ar-EG")}
        </span>
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
        <label className="block text-xs text-muted-foreground">
          نص التنبيه
          <input value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} className={cn(FIELD, "mt-1")} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            اللون/الطابع
            <select
              value={draft.tone}
              onChange={(event) => setDraft({ ...draft, tone: event.target.value as FlashBannerTone })}
              className={cn(FIELD, "mt-1")}
            >
              {(Object.keys(FLASH_TONES) as FlashBannerTone[]).map((value) => (
                <option key={value} value={value}>
                  {FLASH_TONES[value].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            رابط الزر (اختياري)
            <input
              value={draft.linkUrl}
              onChange={(event) => setDraft({ ...draft, linkUrl: event.target.value })}
              placeholder="/shows"
              dir="ltr"
              className={cn(FIELD, "mt-1 font-mono text-xs")}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            نص الزر
            <input value={draft.linkLabel} onChange={(event) => setDraft({ ...draft, linkLabel: event.target.value })} className={cn(FIELD, "mt-1")} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              updateFlashBanner({
                text: draft.text,
                tone: draft.tone,
                linkUrl: draft.linkUrl.trim() || undefined,
                linkLabel: draft.linkLabel.trim() || undefined,
              })
              setNotice("تم حفظ نص التنبيه — ظاهر الآن أعلى الموقع.")
            }}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            حفظ التنبيه
          </button>
          <span className={cn("rounded-full px-4 py-2 text-xs font-semibold", FLASH_TONES[draft.tone].className)}>
            معاينة: {draft.text || "نص التنبيه…"}
          </span>
        </div>
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
