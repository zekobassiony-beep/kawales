"use client"

import { useState } from "react"
import { BarChart3, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { formatCompact } from "@/lib/hq-metrics"
import type { SalesMetric, SalesPoint } from "@/lib/producer-metrics"

/**
 * مخطط مبيعات آخر ١٤ يومًا — Dark Graphite & Gold:
 * أعمدة متجاوبة (CSS) مع تبديل بين المبالغ والتذاكر وإبراز أيام الذروة.
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

export function ProducerSalesChart({
  amountSeries,
  countSeries,
}: {
  amountSeries: SalesPoint[]
  countSeries: SalesPoint[]
}) {
  const [metric, setMetric] = useState<SalesMetric>("amount")
  const series = metric === "amount" ? amountSeries : countSeries
  const max = Math.max(1, ...series.map((point) => point.value))
  const total = series.reduce((sum, point) => sum + point.value, 0)
  const peak = series.find((point) => point.isPeak)

  const label = (value: number) => (metric === "amount" ? formatPrice(value) : `${value} تذكرة`)

  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
            <BarChart3 className="h-4 w-4 text-amber-400" />
            مبيعات آخر ١٤ يومًا
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            الإجمالي: <span className="font-semibold text-amber-400">{label(total)}</span>
            {peak && peak.value > 0 && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Flame className="h-3 w-3" />
                  الذروة {peak.label} ({label(peak.value)})
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
          {([
            { id: "amount" as SalesMetric, label: "المبالغ (ج.م)" },
            { id: "count" as SalesMetric, label: "عدد التذاكر" },
          ]).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMetric(option.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                metric === option.id ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800/60",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* الأعمدة */}
      <div className="mt-5 flex h-44 items-end gap-1.5"> 
        {series.map((point, index) => {
          const height = Math.max(3, Math.round((point.value / max) * 100))
          return (
            <div key={`${point.label}-${index}`} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <span className="invisible text-[9px] font-mono text-amber-300 group-hover:visible">{formatCompact(point.value)}</span>
              <div
                title={`${point.label} — ${label(point.value)}`}
                style={{ height: `${height}%` }}
                className={cn(
                  "w-full rounded-t-lg transition-all",
                  point.isPeak
                    ? "bg-amber-400 shadow-[0_0_22px_-4px_rgba(251,191,36,0.95)]"
                    : "bg-gradient-to-t from-amber-500/40 to-amber-500/80 group-hover:from-amber-500 group-hover:to-amber-400",
                )}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {series.map((point, index) => (
          <span key={`label-${point.label}-${index}`} className="flex-1 text-center text-[9px] text-zinc-500">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  )
}
