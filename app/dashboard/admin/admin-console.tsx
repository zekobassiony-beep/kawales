"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CreditCard,
  DoorOpen,
  KeyRound,
  Megaphone,
  ShieldCheck,
  Theater,
  Ticket,
  Users,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useServerTickets } from "@/components/use-server-tickets"
import { AdminUsersManager } from "@/app/dashboard/admin/admin-users-manager"
import { PaymentManager } from "@/app/hq-kawalees/payment-manager"
import { InviteCenter } from "@/app/hq-kawalees/invite-center"
import { FlashBannerEditor } from "@/app/hq-kawalees/flash-banner-editor"
import { HQKpiGrid, type HqKpi } from "@/app/dashboard/admin/hq/HQKpiGrid"
import { HQAnalyticsCharts } from "@/app/dashboard/admin/hq/HQAnalyticsCharts"
import { HQActionTable } from "@/app/dashboard/admin/hq/HQActionTable"
import { HQQuickActionBar } from "@/app/dashboard/admin/hq/HQQuickActionBar"
import { computeHqMetrics, formatEgpFromCents, type HQEventInput } from "@/lib/hq-metrics"
import { hqOpsStats, useHqOps } from "@/lib/hq-ops"
import { HQ_PATH } from "@/lib/roles"

type AdminTab = "overview" | "payments" | "invites" | "banner" | "admins"

const TABS: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "نظرة عامة", icon: Activity },
  { id: "payments", label: "وسائل الدفع", icon: CreditCard },
  { id: "invites", label: "الأكواد والتوثيق", icon: KeyRound },
  { id: "banner", label: "النشرة العاجلة", icon: Megaphone },
  { id: "admins", label: "إدارة الأدمنز", icon: Users },
]

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-colors hover:border-amber-500/30"

/** يبني ملف CSV للتقرير المالي ويُنزّله. */
function downloadFinancialReport(rows: string[][], filename: string): void {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** لوحة السوبر أدمن (Enterprise HQ — Dark Graphite & Gold). */
export function AdminConsole({
  emails,
  tableReady,
  adminEmail,
  isMaster,
  events,
}: {
  emails: string[]
  tableReady: boolean
  adminEmail: string
  isMaster: boolean
  events: HQEventInput[]
}) {
  const [tab, setTab] = useState<AdminTab>("overview")
  const { tickets, loading, reload } = useServerTickets()
  const ops = useHqOps()
  const opsStats = useMemo(() => hqOpsStats(ops), [ops])

  const metrics = useMemo(
    () =>
      computeHqMetrics({
        events,
        tickets: tickets.map((ticket) => ({
          totalCents: ticket.totalCents,
          status: ticket.status,
          createdAt: ticket.createdAt,
          venue: ticket.venue,
          showTitle: ticket.showTitle,
          seats: ticket.seats,
        })),
        ops,
      }),
    [events, tickets, ops],
  )

  const kpis: HqKpi[] = useMemo(
    () => [
      {
        id: "revenue",
        label: "إجمالي أرباح ومبيعات المنصة",
        value: formatEgpFromCents(metrics.revenueCents),
        hint: `${metrics.ticketsSold} تذكرة معتمدة`,
        icon: Wallet,
        tone: "gold",
        trendPct: metrics.revenueGrowthPct,
        spark: metrics.revenueTrend.map((point) => point.value),
      },
      {
        id: "shows",
        label: "عروض مسرحية شغّالة",
        value: String(metrics.runningShows),
        hint: "معروضة على الجمهور الآن",
        icon: Theater,
        tone: "emerald",
      },
      {
        id: "parties",
        label: "المسارح والفرق المسجّلة",
        value: `${metrics.venues} / ${metrics.troupes}`,
        hint: "مسرح مسجّل / فرقة عاملة",
        icon: Building2,
        tone: "amber",
      },
      {
        id: "urgent",
        label: "طلبات تتطلب إجراءً عاجلًا",
        value: String(metrics.urgentActions),
        hint: `${opsStats.pendingJoins} انضمام · ${opsStats.pendingPayouts} سحب · ${opsStats.openAlerts} بلاغ`,
        icon: AlertTriangle,
        tone: "red",
        attention: metrics.urgentActions > 0,
      },
    ],
    [metrics, opsStats],
  )

  const handleExport = () => {
    const rows: string[][] = [
      ["التقرير المالي — كواليس", new Date().toLocaleString("ar-EG")],
      [],
      ["إجمالي الإيرادات المعتمدة (ج.م)", String(Math.round(metrics.revenueCents / 100))],
      ["نسبة النمو عن الشهر السابق", `${metrics.revenueGrowthPct}%`],
      ["عدد التذاكر المعتمدة", String(metrics.ticketsSold)],
      ["عروض شغّالة", String(metrics.runningShows)],
      [],
      ["كود التذكرة", "العرض", "المقاعد", "الفئة", "الإجمالي (ج.م)", "الحالة", "المكان", "التاريخ"],
      ...tickets.map((ticket) => [
        ticket.id,
        ticket.showTitle,
        ticket.seats.join(" | "),
        ticket.tierName,
        String(Math.round(ticket.totalCents / 100)),
        ticket.status,
        ticket.venue,
        ticket.createdAt,
      ]),
    ]
    downloadFinancialReport(rows, `kawalees-financial-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* ترويسة اللوحة */}
      <div className={cn(CARD, "p-5 hover:border-amber-500/40")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_30px_-10px_rgba(245,158,11,0.9)]">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-serif text-2xl font-bold text-zinc-50">لوحة السوبر أدمن</h1>
              <p className="mt-1 text-xs text-zinc-400" dir="ltr">
                {adminEmail}
                {isMaster && <span className="text-amber-400"> — Master Admin</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Link
              href={HQ_PATH}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
            >
              <DoorOpen className="h-3.5 w-3.5" />
              غرفة العمليات
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <span className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-zinc-400">
              <Ticket className="h-3 w-3" />
              {tickets.length} تذكرة
            </span>
            <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-400">
              <Users className="h-3 w-3" />
              {emails.length} أدمن
            </span>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon
          const activeTab = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                activeTab
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_24px_-10px_rgba(245,158,11,0.9)]"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <HQQuickActionBar
            onOpenInvites={() => setTab("invites")}
            onExport={handleExport}
            onRefresh={() => void reload()}
            refreshing={loading}
          />
          <HQKpiGrid kpis={kpis} />
          <HQAnalyticsCharts metrics={metrics} />
          <HQActionTable />
        </div>
      )}

      {tab === "payments" && <PaymentManager />}
      {tab === "invites" && <InviteCenter />}
      {tab === "banner" && <FlashBannerEditor />}
      {tab === "admins" && <AdminUsersManager initialEmails={emails} tableReady={tableReady} callerEmail={adminEmail} />}
    </div>
  )
}

