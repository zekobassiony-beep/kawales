"use client"

import { cn } from "@/lib/utils"
import type { HQPoint } from "@/lib/hq-metrics"

/**
 * طقم رسوم بيانية داخلي (SVG) بنظام Dark Graphite & Gold — بلا أي مكتبة خارجية
 * (المشروع لا يضم مكتبة رسوم)، وقابل لإعادة الاستخدام في لوحات العميل والمخرج والممثل.
 */

const GOLD = "#f59e0b"
const EMERALD = "#10b981"
const ZINC_GRID = "#27272a"

const CARD =
  "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur transition-colors hover:border-amber-500/30"

export type ChartTone = "gold" | "emerald"

function toneColors(tone: ChartTone): { stroke: string; from: string; to: string } {
  return tone === "emerald"
    ? { stroke: EMERALD, from: "rgba(16,185,129,0.45)", to: "rgba(16,185,129,0)" }
    : { stroke: GOLD, from: "rgba(245,158,11,0.45)", to: "rgba(245,158,11,0)" }
}

/** رأس موحّد لكروت الرسوم. */
export function HqChartHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-serif text-base font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      </div>
      {badge && (
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
          {badge}
        </span>
      )}
    </div>
  )
}

/** إطار موحّد لكروت الرسوم. */
export function HqChartCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(CARD, className)}>{children}</div>
}

/** رسم خطي/مساحي (Area Chart) للإيرادات عبر الزمن — تدرّج ذهبي أو زمردي. */
export function HqAreaChart({
  title,
  subtitle,
  badge,
  points,
  tone = "gold",
  formatValue,
}: {
  title: string
  subtitle: string
  badge?: string
  points: HQPoint[]
  tone?: ChartTone
  formatValue: (value: number) => string
}) {
  const colors = toneColors(tone)
  const width = 620
  const height = 220
  const padX = 34
  const padTop = 18
  const padBottom = 34
  const max = Math.max(1, ...points.map((point) => point.value))
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0
  const scaleY = (value: number) => height - padBottom - (value / max) * (height - padTop - padBottom)

  const coords = points.map((point, index) => ({ x: padX + index * stepX, y: scaleY(point.value), point }))
  const line = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`)
    .join(" ")
  const area = `${line} L${(coords[coords.length - 1]?.x ?? padX).toFixed(1)},${height - padBottom} L${padX},${height - padBottom} Z`

  return (
    <HqChartCard>
      <HqChartHeader title={title} subtitle={subtitle} badge={badge} />
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`hq-area-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + ratio * (height - padTop - padBottom)
          return <line key={ratio} x1={padX} y1={y} x2={width - padX} y2={y} stroke={ZINC_GRID} strokeWidth={1} />
        })}

        <path d={area} fill={`url(#hq-area-${tone})`} />
        <path
          d={line}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {coords.map((coord) => (
          <g key={coord.point.label}>
            <circle cx={coord.x} cy={coord.y} r={3.5} fill="#18181b" stroke={colors.stroke} strokeWidth={2} />
            <text x={coord.x} y={height - 12} textAnchor="middle" className="fill-zinc-500" fontSize={11}>
              {coord.point.label}
            </text>
          </g>
        ))}

        <text x={padX} y={padTop - 4} className="fill-zinc-500" fontSize={10}>
          {formatValue(max)}
        </text>
      </svg>
    </HqChartCard>
  )
}

/** رسم أعمدة أفقي (Bar Chart) — مناسب للعناوين العربية الطويلة. */
export function HqBarChart({
  title,
  subtitle,
  badge,
  points,
  tone = "gold",
  formatValue,
}: {
  title: string
  subtitle: string
  badge?: string
  points: HQPoint[]
  tone?: ChartTone
  formatValue: (value: number) => string
}) {
  const colors = toneColors(tone)
  const max = Math.max(1, ...points.map((point) => point.value))

  return (
    <HqChartCard>
      <HqChartHeader title={title} subtitle={subtitle} badge={badge} />
      {points.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">لا توجد بيانات كافية بعد.</p>
      ) : (
        <ul className="space-y-3">
          {points.map((point) => {
            const pct = Math.round((point.value / max) * 100)
            return (
              <li key={point.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-zinc-300">{point.label}</span>
                  <span className="shrink-0 font-mono text-amber-400" dir="ltr">
                    {formatValue(point.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      tone === "emerald" ? "bg-emerald-500" : "bg-amber-500",
                    )}
                    style={{ width: `${Math.max(4, pct)}%`, boxShadow: `0 0 18px -3px ${colors.stroke}` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </HqChartCard>
  )
}

/** رسم دائري (Donut) لتوزيع نسب إشغال المسارح. */
export function HqDonutChart({
  title,
  subtitle,
  badge,
  segments,
}: {
  title: string
  subtitle: string
  badge?: string
  segments: { label: string; value: number; caption: string }[]
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const palette = [GOLD, EMERALD, "#a1a1aa", "#7c5cff", "#f97316"]

  let offset = 0
  const arcs = segments.map((segment, index) => {
    const fraction = total > 0 ? Math.max(0, segment.value) / total : 0
    const arc = {
      label: segment.label,
      caption: segment.caption,
      color: palette[index % palette.length],
      dash: `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`,
      offset,
    }
    offset += fraction * circumference
    return arc
  })

  return (
    <HqChartCard>
      <HqChartHeader title={title} subtitle={subtitle} badge={badge} />
      {arcs.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">لا توجد بيانات إشغال بعد.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label={title}>
            <circle cx="60" cy="60" r={radius} fill="none" stroke={ZINC_GRID} strokeWidth="13" />
            {arcs.map((arc) => (
              <circle
                key={arc.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth="13"
                strokeDasharray={arc.dash}
                strokeDashoffset={-arc.offset}
              />
            ))}
          </svg>

          <ul className="min-w-40 flex-1 space-y-2">
            {arcs.map((arc) => (
              <li key={arc.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
                  <span className="truncate text-zinc-300">{arc.label}</span>
                </span>
                <span className="shrink-0 font-mono text-zinc-400">{arc.caption}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HqChartCard>
  )
}

