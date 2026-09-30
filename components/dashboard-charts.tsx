"use client"

/**
 * طقم رسوم بيانية موحّد لكل اللوحات (بلا أي مكتبة خارجية — SVG + CSS).
 *
 * مصمَّم بعمق بصري ثلاثي الأبعاد: تدرّجات، حلقات مضيئة، وظلال، ويستخدم ألوان
 * الثيم (`primary`/`card`/`border`) ليظهر بنفس الشكل في كل الفئات.
 */

export type ChartPoint = { label: string; value: number }

const TONES = {
  gold: { from: "#fbbf24", to: "#b45309", glow: "rgba(251,191,36,0.35)" },
  emerald: { from: "#34d399", to: "#047857", glow: "rgba(52,211,153,0.35)" },
  violet: { from: "#a78bfa", to: "#6d28d9", glow: "rgba(167,139,250,0.35)" },
  cyan: { from: "#22d3ee", to: "#0e7490", glow: "rgba(34,211,238,0.35)" },
} as const

export type ChartTone3D = keyof typeof TONES

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}م`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}ألف`
  return String(Math.round(value))
}

/** بطاقة إحصائية بعمق ثلاثي الأبعاد (توهّج + ظل + حركة عند المرور). */
export function StatOrb({
  label,
  value,
  hint,
  icon,
  tone = "gold",
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  tone?: ChartTone3D
}) {
  const colors = TONES[tone]
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1"
      style={{ boxShadow: `0 22px 45px -30px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.06)` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, ${colors.from}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-serif text-2xl font-bold" dir="auto">
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-950"
            style={{ backgroundImage: `linear-gradient(140deg, ${colors.from}, ${colors.to})` }}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  )
}

/** رسم دائري (Donut) لتوزيع النسب. */
export function DonutSplit({
  title,
  subtitle,
  segments,
}: {
  title: string
  subtitle?: string
  segments: { label: string; value: number; caption: string; tone?: ChartTone3D }[]
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const palette: ChartTone3D[] = ["gold", "emerald", "violet", "cyan"]

  let offset = 0
  const arcs = segments.map((segment, index) => {
    const fraction = total > 0 ? Math.max(0, segment.value) / total : 0
    const tone = segment.tone ?? palette[index % palette.length]
    const arc = {
      ...segment,
      color: TONES[tone].from,
      glow: TONES[tone].glow,
      dash: `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`,
      offset,
    }
    offset += fraction * circumference
    return arc
  })

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="font-serif text-base font-semibold">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
      {total === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">لا بيانات بعد.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={title}>
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#27272a" strokeWidth="14" />
              {arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="14"
                  strokeDasharray={arc.dash}
                  strokeDashoffset={-arc.offset}
                  style={{ filter: `drop-shadow(0 0 6px ${arc.glow})` }}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-lg font-bold">{formatCompactNumber(total)}</span>
            </div>
          </div>
          <ul className="min-w-40 flex-1 space-y-2">
            {arcs.map((arc) => (
              <li key={arc.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
                  <span className="truncate text-muted-foreground">{arc.label}</span>
                </span>
                <span className="shrink-0 font-mono">{arc.caption}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** عدّاد نصف دائري (Gauge) بنسبة مئوية بعمق مضيء. */
export function Gauge3D({
  title,
  percent,
  caption,
  tone = "emerald",
}: {
  title: string
  percent: number
  caption?: string
  tone?: ChartTone3D
}) {
  const colors = TONES[tone]
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius = 54
  const circumference = Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="font-serif text-base font-semibold">{title}</p>
      <div className="mt-3 flex flex-col items-center">
        <svg viewBox="0 0 140 80" className="h-24 w-40" role="img" aria-label={`${title} ${clamped}%`}>
          <defs>
            <linearGradient id={`gauge-${tone}`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={colors.to} />
              <stop offset="100%" stopColor={colors.from} />
            </linearGradient>
          </defs>
          <path
            d={`M 16 72 A ${radius} ${radius} 0 0 1 124 72`}
            fill="none"
            stroke="#27272a"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={`M 16 72 A ${radius} ${radius} 0 0 1 124 72`}
            fill="none"
            stroke={`url(#gauge-${tone})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(2)} ${circumference.toFixed(2)}`}
            style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
          />
        </svg>
        <span className="-mt-6 font-serif text-2xl font-bold">{clamped}%</span>
        {caption && <span className="mt-1 text-center text-[11px] text-muted-foreground">{caption}</span>}
      </div>
    </div>
  )
}

/** أعمدة مقارنة بقيم كل عنصر (مع تلميح عند المرور). */
export function BarSeries({
  title,
  subtitle,
  points,
  formatValue,
  tone = "gold",
}: {
  title: string
  subtitle?: string
  points: ChartPoint[]
  formatValue?: (value: number) => string
  tone?: ChartTone3D
}) {
  const colors = TONES[tone]
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="font-serif text-base font-semibold">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
      {points.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">لا بيانات بعد.</p>
      ) : (
        <>
          <div className="mt-5 flex h-40 items-end gap-2">
            {points.map((point) => {
              const height = Math.max(4, Math.round((point.value / max) * 100))
              return (
                <div key={point.label} className="group flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="invisible text-[9px] font-mono text-muted-foreground group-hover:visible">
                    {formatValue ? formatValue(point.value) : formatCompactNumber(point.value)}
                  </span>
                  <div
                    title={`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}
                    style={{
                      height: `${height}%`,
                      backgroundImage: `linear-gradient(180deg, ${colors.from}, ${colors.to})`,
                      boxShadow: `0 12px 22px -14px ${colors.glow}`,
                    }}
                    className="w-full rounded-t-lg transition-all duration-300 group-hover:brightness-110"
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {points.map((point) => (
              <span key={`label-${point.label}`} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
                {point.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** سطر تقدّم أفقي (لتوزيع الحالات). */
export function ProgressRow({
  label,
  value,
  total,
  tone = "gold",
}: {
  label: string
  value: number
  total: number
  tone?: ChartTone3D
}) {
  const colors = TONES[tone]
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(3, percent)}%`,
            backgroundImage: `linear-gradient(90deg, ${colors.to}, ${colors.from})`,
            boxShadow: `0 0 14px -2px ${colors.glow}`,
          }}
        />
      </div>
    </li>
  )
}
