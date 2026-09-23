"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, BadgeCheck, Ban, CheckCircle2, ChevronDown, Eye, HandCoins, UserPlus, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  ALERT_STATUS_LABELS,
  HQ_KIND_LABELS,
  JOIN_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  SEVERITY_LABELS,
  decideJoinRequest,
  decidePayout,
  resolveAlert,
  useHqOps,
} from "@/lib/hq-ops"
import { formatEgpFromCents } from "@/lib/hq-metrics"

/**
 * جدول الإجراءات الفورية (HQ Tabbed Action Table) — Dark Graphite & Gold:
 * ثلاث تبويبات قرار: طلبات الانضمام · طلبات سحب الأرباح · البلاغات العاجلة.
 * كل الأزرار حقيقية وتُحدّث مخزن العمليات (`lib/hq-ops`).
 */

type ActionTab = "joins" | "payouts" | "alerts"

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"
const SMALL_BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors"

const JOIN_TONES = { pending: "amber", approved: "green", rejected: "red" } as const
const PAYOUT_TONES = { pending: "amber", approved: "green", on_hold: "gray" } as const
const ALERT_TONES = { open: "red", resolved: "green" } as const

export function HQActionTable() {
  const ops = useHqOps()
  const [tab, setTab] = useState<ActionTab>("joins")
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const counts = useMemo(
    () => ({
      joins: ops.joinRequests.filter((item) => item.status === "pending").length,
      payouts: ops.payouts.filter((item) => item.status === "pending").length,
      alerts: ops.alerts.filter((item) => item.status === "open").length,
    }),
    [ops],
  )

  const tabs: { id: ActionTab; label: string; icon: typeof UserPlus; pending: number }[] = [
    { id: "joins", label: "طلبات انضمام الفرق والمسارح", icon: UserPlus, pending: counts.joins },
    { id: "payouts", label: "طلبات سحب الأرباح", icon: HandCoins, pending: counts.payouts },
    { id: "alerts", label: "التنبيهات والبلاغات العاجلة", icon: AlertTriangle, pending: counts.alerts },
  ]

  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-base font-semibold text-zinc-100">جدول الإجراءات الفورية</h3>
          <p className="mt-1 text-[11px] text-zinc-500">قرارات فورية على طلبات الانضمام والسحب والبلاغات الحسّاسة.</p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
          {counts.joins + counts.payouts + counts.alerts} بانتظار إجراء
        </span>
      </div>

      {/* تبويبات القرار */}
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id)
                setOpenId(null)
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors",
                active
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {item.pending > 0 && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                  {item.pending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {notice}
        </p>
      )}

      {/* صفوف القرار حسب التبويب */}
      <div className="mt-4 overflow-x-auto">
        {tab === "joins" && (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-xs text-zinc-400">
                <th className="px-3 py-3 font-medium">الجهة</th>
                <th className="px-3 py-3 font-medium">النوع</th>
                <th className="px-3 py-3 font-medium">المحافظة</th>
                <th className="px-3 py-3 font-medium">الحالة</th>
                <th className="px-3 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ops.joinRequests.map((item) => (
                <tr key={item.id} className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
                  <td className="px-3 py-3">
                    <span className="block text-xs font-semibold text-zinc-100">{item.name}</span>
                    <span className="block font-mono text-[10px] text-zinc-500" dir="ltr">
                      {item.email}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-300">{HQ_KIND_LABELS[item.kind]}</td>
                  <td className="px-3 py-3 text-xs text-zinc-300">{item.city}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={JOIN_TONES[item.status]}>{JOIN_STATUS_LABELS[item.status]}</StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === item.id ? null : item.id)}
                        className={cn(SMALL_BTN, "border-zinc-800 text-zinc-300 hover:bg-zinc-800/60")}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        معاينة التفاصيل
                        <ChevronDown className={cn("h-3 w-3 transition-transform", openId === item.id && "rotate-180")} />
                      </button>
                      <button
                        type="button"
                        disabled={item.status === "approved"}
                        onClick={() => {
                          decideJoinRequest(item.id, "approved")
                          setNotice(`تم قبول وتفعيل «${item.name}».`)
                        }}
                        className={cn(SMALL_BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40")}
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        قبول والتفعيل
                      </button>
                      <button
                        type="button"
                        disabled={item.status === "rejected"}
                        onClick={() => {
                          decideJoinRequest(item.id, "rejected")
                          setNotice(`تم رفض طلب «${item.name}».`)
                        }}
                        className={cn(SMALL_BTN, "border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40")}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        رفض
                      </button>
                    </div>
                    {openId === item.id && (
                      <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-400">
                        {item.note}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "payouts" && (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-xs text-zinc-400">
                <th className="px-3 py-3 font-medium">الجهة</th>
                <th className="px-3 py-3 font-medium">المبلغ المطلوب</th>
                <th className="px-3 py-3 font-medium">الوسيلة</th>
                <th className="px-3 py-3 font-medium">الحالة</th>
                <th className="px-3 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ops.payouts.map((item) => (
                <tr key={item.id} className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
                  <td className="px-3 py-3">
                    <span className="block text-xs font-semibold text-zinc-100">{item.party}</span>
                    <span className="block text-[10px] text-zinc-500">{HQ_KIND_LABELS[item.kind]}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-amber-400">{formatEgpFromCents(item.amountCents)}</td>
                  <td className="px-3 py-3 text-xs text-zinc-300">{item.method}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={PAYOUT_TONES[item.status]}>{PAYOUT_STATUS_LABELS[item.status]}</StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={item.status === "approved"}
                        onClick={() => {
                          decidePayout(item.id, "approved")
                          setNotice(`تم اعتماد سداد ${formatEgpFromCents(item.amountCents)} لـ «${item.party}».`)
                        }}
                        className={cn(SMALL_BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        اعتماد السداد
                      </button>
                      <button
                        type="button"
                        disabled={item.status === "on_hold"}
                        onClick={() => {
                          decidePayout(item.id, "on_hold")
                          setNotice(`تم تعليق طلب «${item.party}» للمراجعة.`)
                        }}
                        className={cn(SMALL_BTN, "border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40")}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        تعليق للمراجعة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "alerts" && (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-xs text-zinc-400">
                <th className="px-3 py-3 font-medium">البلاغ</th>
                <th className="px-3 py-3 font-medium">الخطورة</th>
                <th className="px-3 py-3 font-medium">الحالة</th>
                <th className="px-3 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {ops.alerts.map((item) => (
                <tr key={item.id} className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
                  <td className="px-3 py-3">
                    <span className="block text-xs font-semibold text-zinc-100">{item.title}</span>
                    <span className="block text-[10px] text-zinc-500">{item.detail}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-300">{SEVERITY_LABELS[item.severity]}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={ALERT_TONES[item.status]}>{ALERT_STATUS_LABELS[item.status]}</StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={item.status === "resolved"}
                      onClick={() => {
                        resolveAlert(item.id)
                        setNotice(`تمت معالجة البلاغ «${item.title}».`)
                      }}
                      className={cn(SMALL_BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40")}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      تمت المعالجة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
