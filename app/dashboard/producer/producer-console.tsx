"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Armchair, Ticket, TrendingUp, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatEgpFromCents } from "@/lib/hq-metrics"
import { HQKpiGrid, type HqKpi } from "@/app/dashboard/admin/hq/HQKpiGrid"
import type { Ticket as TicketModel } from "@/lib/tickets"
import { listProducerTickets } from "@/app/actions/tickets"
import {
  producerKpis,
  producerShowRows,
  salesSeries,
  type ProducerEventInput,
} from "@/lib/producer-metrics"
import { ProducerSalesChart } from "@/app/dashboard/producer/producer-sales-chart"
import { ProducerShows } from "@/app/dashboard/producer/producer-shows"
import { ProducerReceipts } from "@/app/dashboard/producer/producer-receipts"
import { ProducerCasting } from "@/app/dashboard/producer/producer-casting"

/**
 * لوحة المخرج ومنظم العروض (Producer HQ) — Dark Graphite & Gold:
 * مؤشرات تنفيذية + مخطط ١٤ يومًا + حالة العروض + مراجعة الإيصالات + الكاستينج.
 */
export function ProducerConsole({ events }: { events: ProducerEventInput[] }) {
  const [tickets, setTickets] = useState<TicketModel[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTickets(await listProducerTickets())
    } catch {
      // نتجاهل الفشل ونُبقي آخر قراءة ناجحة.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const capacityOf = useCallback((event: ProducerEventInput) => event.capacity, [])
  const soldCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const ticket of tickets) {
      if (ticket.status !== "approved" && ticket.status !== "checked_in") continue
      counts.set(Number(ticket.showId), (counts.get(Number(ticket.showId)) ?? 0) + Math.max(1, ticket.seats.length))
    }
    return counts
  }, [tickets])

  const kpis = useMemo(() => producerKpis({ tickets, events, capacityOf }), [tickets, events, capacityOf])
  const rows = useMemo(() => producerShowRows(events, soldCounts, capacityOf), [events, soldCounts, capacityOf])
  const amountSeries = useMemo(() => salesSeries(tickets, "amount"), [tickets])
  const countSeries = useMemo(() => salesSeries(tickets, "count"), [tickets])

  const cards: HqKpi[] = [
    {
      id: "revenue",
      label: "إجمالي المبيعات",
      value: formatEgpFromCents(kpis.revenueCents),
      hint: "المبالغ المحصّلة بعد اعتماد الإيصالات",
      icon: TrendingUp,
      tone: "emerald",
      trendPct: kpis.revenueTrendPct,
      spark: amountSeries.map((point) => point.value),
    },
    {
      id: "sold",
      label: "التذاكر المباعة",
      value: kpis.capacity > 0 ? `${kpis.ticketsSold} / ${kpis.capacity}` : String(kpis.ticketsSold),
      hint: "من إجمالي سعة العروض",
      icon: Ticket,
      tone: "gold",
    },
    {
      id: "occupancy",
      label: "متوسط نسبة الإشغال",
      value: `${kpis.occupancyPct}%`,
      hint: "لكل العروض المعروضة",
      icon: Armchair,
      tone: "amber",
    },
    {
      id: "pending",
      label: "تحويلات قيد المراجعة",
      value: `${kpis.pendingReceipts} إيصال`,
      hint: `${kpis.rejected} إيصال مرفوض`,
      icon: AlertTriangle,
      tone: "red",
      attention: kpis.pendingReceipts > 0,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_30px_-10px_rgba(245,158,11,0.9)]">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-bold text-zinc-50">لوحة المخرج ومنظم العروض</h1>
            <p className="mt-1 text-xs text-zinc-400">مركز عمليات الفرقة: المبيعات، الإشغال، الإيصالات، والكاستينج.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className={cn(
            "rounded-xl border border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800/60",
            loading && "opacity-60",
          )}
        >
          {loading ? "جارٍ التحديث…" : "تحديث البيانات"}
        </button>
      </header>

      <section className="mt-6">
        <HQKpiGrid kpis={cards} />
      </section>

      <section id="producer-sales" className="mt-6">
        <ProducerSalesChart amountSeries={amountSeries} countSeries={countSeries} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <ProducerShows rows={rows} />
        <ProducerReceipts tickets={tickets} onDecided={() => void reload()} />
      </section>

      <section className="mt-6">
        <ProducerCasting />
      </section>
    </div>
  )
}
