"use client"

import { Download, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * شريط الإجراءات السريعة (Quick Action Bar) — Dark Graphite & Gold:
 * توليد كود انضمام سريع (يفتح التبويب المخصص) · تصدير التقرير المالي · تحديث البيانات.
 */
export function HQQuickActionBar({
  onOpenInvites,
  onExport,
  onRefresh,
  refreshing,
}: {
  onOpenInvites: () => void
  onExport: () => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const base =
    "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50"

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur">
      <button
        type="button"
        onClick={onOpenInvites}
        className={cn(base, "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25")}
      >
        <Sparkles className="h-3.5 w-3.5" />
        توليد كود انضمام سريع
      </button>

      <button
        type="button"
        onClick={onExport}
        className={cn(base, "border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/60")}
      >
        <Download className="h-3.5 w-3.5" />
        تصدير التقرير المالي
      </button>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className={cn(base, "border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/60")}
      >
        {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        تحديث البيانات
      </button>

      <span className="ms-auto text-[11px] text-zinc-500">
        {refreshing ? "جارٍ تحديث الحجوزات من Supabase…" : "المصدر: Supabase + قاعدة العروض"}
      </span>
    </div>
  )
}
