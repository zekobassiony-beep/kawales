"use client"

import Link from "next/link"
import { Armchair, BarChart3, CalendarCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/format"
import { StatusBadge } from "@/app/dashboard/ui"
import type { ProducerShowRow } from "@/lib/producer-metrics"

/** جدول/كروت العروض مع شريط الإشغال المتدرج وشارة الحالة وأزرار التحكم السريع. */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"
const BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"

export function ProducerShows({ rows }: { rows: ProducerShowRow[] }) {
  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
          <Armchair className="h-4 w-4 text-amber-400" />
          حالة العروض ونسب الإشغال
        </h3>
        <span className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-400">{rows.length} عرض</span>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{row.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {row.venue} · {formatDate(row.startsAtIso)} — {formatTime(row.startsAtIso)}
                </p>
              </div>
              <StatusBadge tone={row.badge.tone}>{row.badge.label}</StatusBadge>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">
                  {row.sold} / {row.capacity} مقعد · {row.occupancy.remaining} متبقٍ
                </span>
                <span className="font-mono text-zinc-500">{row.occupancy.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn("h-full rounded-full transition-all", row.occupancy.barClass)}
                  style={{ width: `${row.occupancy.pct}%` }}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard/troupe" className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60")}>
                <CalendarCog className="h-3.5 w-3.5" />
                تعديل المواعيد
              </Link>
              <Link href={`/shows/${row.slug}/book`} className={cn(BTN, "border-zinc-800 text-zinc-200 hover:bg-zinc-800/60")}>
                <Armchair className="h-3.5 w-3.5" />
                إدارة الكراسي
              </Link>
              <a href="#producer-sales" className={cn(BTN, "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20")}>
                <BarChart3 className="h-3.5 w-3.5" />
                تقرير المبيعات
              </a>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center text-xs text-zinc-500">
            لا توجد عروض مسجّلة بعد — أنشئ عرضًا من لوحة الفرقة.
          </li>
        )}
      </ul>
    </div>
  )
}
