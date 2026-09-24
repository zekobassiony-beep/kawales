"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCheck, Clock3, TicketCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Ticket } from "@/lib/tickets"
import { getUserTickets } from "@/app/actions/tickets"
import { passStats, splitByTab, type PassTab } from "@/lib/ticket-pass"
import { TicketPassCard } from "@/app/dashboard/tickets/ticket-pass-card"

/**
 * صفحة «حجوزاتي وتذاكري» (Digital Ticket Pass) — Dark Graphite & Gold:
 * 3 كروت إحصائية + 3 تبويبات تصفية + كروت تذاكر بأسلوب بوردينج باس.
 */
export function TicketPassConsole({ mapsByVenue }: { mapsByVenue: Record<string, string> }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<PassTab>("upcoming")

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTickets(await getUserTickets())
    } catch {
      // نتجاهل الفشل ونُبقي آخر قراءة ناجحة.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /** يطابق رابط خريطة المسرح من وصف المكان («اسم المسرح، المدينة»). */
  const mapsFor = useCallback(
    (venueLabel: string) => {
      const venueName = venueLabel.split(/[،,]/)[0]?.trim() ?? ""
      return mapsByVenue[venueName] ?? null
    },
    [mapsByVenue],
  )

  const buckets = useMemo(() => splitByTab(tickets), [tickets])
  const stats = useMemo(() => passStats(tickets), [tickets])
  const allPrices = useMemo(
    () => tickets.map((ticket) => Math.round(ticket.totalCents / Math.max(1, ticket.seats.length))),
    [tickets],
  )
  const shown = buckets[tab]

  const cards = [
    { id: "upcoming", label: "التذاكر النشطة القادمة", value: stats.activeUpcoming, icon: TicketCheck, tone: "gold" },
    { id: "attended", label: "العروض التي حضرتها", value: stats.attended, icon: CalendarCheck, tone: "emerald" },
    { id: "pending", label: "قيد المراجعة", value: stats.pending, icon: Clock3, tone: "amber" },
  ] as const

  const tabs: { id: PassTab; label: string; count: number }[] = [
    { id: "upcoming", label: "التذاكر القادمة والنشطة", count: buckets.upcoming.length },
    { id: "past", label: "سجل العروض السابقة", count: buckets.past.length },
    { id: "pending", label: "طلبات قيد المراجعة والرفض", count: buckets.pending.length },
  ]

  const toneClass = (tone: string) =>
    tone === "gold"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : "border-amber-500/25 bg-amber-500/10 text-amber-300"

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold text-zinc-50">حجوزاتي وتذاكري</h1>
            <p className="mt-1 text-xs text-zinc-400">ممرك الرقمي للتذاكر — اعرض الرمز عند بوابة المسرح.</p>
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

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur transition-colors hover:border-amber-500/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">{card.label}</p>
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", toneClass(card.tone))}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 font-serif text-4xl font-bold text-amber-400">{card.value}</p>
              </div>
            )
          })}
        </section>

        <section className="mt-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                tab === item.id
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50",
              )}
            >
              {item.label}
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">{item.count}</span>
            </button>
          ))}
        </section>

        <section className="mt-5 space-y-4">
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-10 text-center text-sm text-zinc-500">
              {loading ? "جارٍ تحميل تذاكرك من Supabase…" : "لا توجد تذاكر في هذا التبويب بعد."}
            </p>
          ) : (
            shown.map((ticket) => (
              <TicketPassCard
                key={ticket.id}
                ticket={ticket}
                allPrices={allPrices}
                mapsUrl={mapsFor(ticket.venue)}
                onChanged={() => void reload()}
              />
            ))
          )}
        </section>
      </div>
    </div>
  )
}
