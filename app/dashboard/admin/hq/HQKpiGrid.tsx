"use client"

import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * شبكة مؤشرات تنفيذية (Executive KPI Cards) بنظام Dark Graphite & Gold:
 * كروت بخلفية graphite وحواف داكنة وإضاءة ذهبية، مع مؤشر اتجاه وخط مصغّر (Sparkline).
 */

export type HqKpiTone = "gold" | "emerald" | "amber" | "red"

export type HqKpi = {
  id: string
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone?: HqKpiTone
  /** نسبة التغيّر (%) — تُعرض كشارة اتجاه إيجابي/سلبي. */
  trendPct?: number
  /** سلسلة مصغّرة للرسم داخل الكارت. */
  spark?: number[]
  /** هل الكارت يحتاج انتباهًا فوريًا (إضاءة تحذيرية)؟ */
  attention?: boolean
}

const TONE_GLOW: Record<HqKpiTone, string> = {
  gold: "shadow-[0_0_30px_-12px_rgba(245,158,11,0.95)] text-amber-400 border-amber-500/30 bg-amber-500/10",
  emerald: "shadow-[0_0_30px_-12px_rgba(16,185,129,0.95)] text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  amber: "shadow-[0_0_30px_-12px_rgba(217,119,6,0.9)] text-amber-300 border-amber-500/25 bg-amber-500/10",
  red: "shadow-[0_0_30px_-12px_rgba(239,68,68,0.95)] text-red-400 border-red-500/30 bg-red-500/10",
}

/** خط مصغّر (Sparkline) داخل كارت المؤشر. */
function Sparkline({ values, tone }: { values: number[]; tone: HqKpiTone }) {
  if (values.length < 2) return null
  const width = 96
  const height = 28
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(1, max - min)
  const step = width / (values.length - 1)
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(height - ((value - min) / span) * height).toFixed(1)}`)
    .join(" ")
  const stroke = tone === "emerald" ? "#10b981" : tone === "red" ? "#ef4444" : "#f59e0b"

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-24" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function HQKpiGrid({ kpis }: { kpis: HqKpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const tone = kpi.tone ?? "gold"
        const Icon = kpi.icon
        const TrendIcon = kpi.trendPct === undefined ? Minus : kpi.trendPct > 0 ? ArrowUpRight : kpi.trendPct < 0 ? ArrowDownRight : Minus
        const trendPositive = (kpi.trendPct ?? 0) >= 0

        return (
          <div
            key={kpi.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur transition-all",
              "hover:border-amber-500/40 hover:shadow-[0_0_40px_-18px_rgba(245,158,11,0.9)]",
              kpi.attention && "border-amber-500/40",
            )}
          >
            {/* إضاءة ذهبية علوية */}
            <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-opacity group-hover:opacity-100" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-400">{kpi.label}</p>
                <p className="mt-1.5 font-serif text-3xl font-bold text-amber-400">{kpi.value}</p>
              </div>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", TONE_GLOW[tone])}>
                <Icon className="h-5 w-5" />
              </span>
            </div>

            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] text-zinc-500">{kpi.hint}</p>
                {kpi.trendPct !== undefined && (
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      trendPositive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/40 bg-red-500/10 text-red-300",
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {trendPositive ? "+" : ""}
                    {kpi.trendPct}% عن الشهر السابق
                  </span>
                )}
              </div>
              {kpi.spark && <Sparkline values={kpi.spark} tone={tone} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
