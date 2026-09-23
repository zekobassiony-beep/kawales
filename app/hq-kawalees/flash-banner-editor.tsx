"use client"

import { useState } from "react"
import { Megaphone, Radio, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { FLASH_TONES, toggleFlashBanner, updateFlashBanner, useFlashBanner, type FlashBannerTone } from "@/lib/flash-banner"

/**
 * نشرة التنبيهات العاجلة (Flash Banner) — Dark Graphite & Gold:
 * مفتاح تشغيل (Toggle Switch) + شريط حالة + إدخالات فاخرة + معاينة حية حقيقية.
 * المنطق كما هو تمامًا (`toggleFlashBanner` / `updateFlashBanner`).
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-colors"
const FIELD =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"

export function FlashBannerEditor() {
  const banner = useFlashBanner()
  const [draft, setDraft] = useState({
    text: banner.text,
    tone: banner.tone,
    linkUrl: banner.linkUrl ?? "",
    linkLabel: banner.linkLabel ?? "",
  })
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Megaphone className="h-4 w-4" />
          </span>
          نشرة التنبيهات العاجلة (Flash Banner)
        </h2>
        <p className="mt-1.5 text-xs text-zinc-400">
          شريط يظهر أعلى كل صفحات الموقع فور التفعيل — للعروض العاجلة أو تنبيهات تغيير المواعيد.
        </p>
      </div>

      {/* كارت التفعيل + شريط الحالة */}
      <div className={cn(CARD, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={banner.enabled}
              aria-label="تشغيل/إخفاء شريط التنبيه"
              onClick={() => {
                toggleFlashBanner()
                setNotice(banner.enabled ? "تم إخفاء الشريط من الموقع." : "تم إظهار الشريط أعلى الموقع.")
              }}
              className={cn(
                "relative h-7 w-13 shrink-0 rounded-full border transition-colors",
                banner.enabled
                  ? "border-emerald-500/50 bg-emerald-500/25 shadow-[0_0_22px_-6px_rgba(16,185,129,0.9)]"
                  : "border-zinc-700 bg-zinc-800/70",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-5 w-5 rounded-full bg-zinc-100 shadow transition-all",
                  banner.enabled ? "left-7" : "left-1",
                )}
              />
            </button>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{banner.enabled ? "الشريط مفعّل" : "الشريط مُطفأ"}</p>
              <p className="text-[11px] text-zinc-500">آخر تعديل: {new Date(banner.updatedAt).toLocaleString("ar-EG")}</p>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold backdrop-blur",
              banner.enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-400",
            )}
          >
            <Radio className={cn("h-3.5 w-3.5", banner.enabled && "animate-pulse")} />
            {banner.enabled ? "معروض حيًّا أعلى كل صفحات الموقع" : "مخفي عن الجمهور"}
          </div>
        </div>
      </div>

      {/* الإدخالات */}
      <div className={cn(CARD, "space-y-4 p-5")}>
        <label className="block text-xs text-zinc-400">
          نص التنبيه
          <input
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            className={cn(FIELD, "mt-1.5")}
            placeholder="مثال: خصم 20% على حفلات الجمعة — الكمية محدودة"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-400">
            اللون/الطابع
            <select
              value={draft.tone}
              onChange={(event) => setDraft({ ...draft, tone: event.target.value as FlashBannerTone })}
              className={cn(FIELD, "mt-1.5")}
            >
              {(Object.keys(FLASH_TONES) as FlashBannerTone[]).map((value) => (
                <option key={value} value={value}>
                  {FLASH_TONES[value].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            رابط الزر (اختياري)
            <input
              value={draft.linkUrl}
              onChange={(event) => setDraft({ ...draft, linkUrl: event.target.value })}
              placeholder="/shows"
              dir="ltr"
              className={cn(FIELD, "mt-1.5 font-mono text-xs")}
            />
          </label>
          <label className="text-xs text-zinc-400">
            نص الزر
            <input
              value={draft.linkLabel}
              onChange={(event) => setDraft({ ...draft, linkLabel: event.target.value })}
              className={cn(FIELD, "mt-1.5")}
              placeholder="اكتشف العروض"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Save className="h-4 w-4" />
            حفظ التنبيه
          </button>
          <span className="text-[11px] text-zinc-500">يُحفظ فورًا ويظهر أعلى الصفحات لحظيًا.</span>
        </div>

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 backdrop-blur"
          >
            {notice}
          </p>
        )}
      </div>

      {/* المعاينة الحية */}
      <div className={cn(CARD, "p-5")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-serif text-base font-semibold text-zinc-100">المعاينة الحية (Live Preview)</h3>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
            كما سيراه الجمهور
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-red-500/70" />
            <span className="h-2 w-2 rounded-full bg-amber-500/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
            <span className="ms-2 font-mono text-[10px] text-zinc-500" dir="ltr">
              kawalees.com
            </span>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-2 px-4 py-3 text-xs font-semibold",
              FLASH_TONES[draft.tone].className,
            )}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>{draft.text || "نص التنبيه سيظهر هنا…"}</span>
            {draft.linkLabel.trim().length > 0 && (
              <span className="rounded-full bg-black/25 px-3 py-0.5 text-[11px]">{draft.linkLabel}</span>
            )}
          </div>

          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded-full bg-zinc-800" />
            <div className="h-3 w-2/3 rounded-full bg-zinc-800/70" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-800/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

