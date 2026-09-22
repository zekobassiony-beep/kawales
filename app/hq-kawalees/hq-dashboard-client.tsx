"use client"

import { useMemo, useState } from "react"
import { Activity, BadgeCheck, CreditCard, KeyRound, Megaphone, ShieldCheck, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTickets } from "@/lib/tickets"
import { usePaymentMethods } from "@/lib/payment-methods"
import { inviteCodeStats, useInviteCodes } from "@/lib/invite-codes"
import { useVerifiedEntities } from "@/lib/badges"
import { useReviews } from "@/lib/reviews"
import { useFlashBanner } from "@/lib/flash-banner"
import { PaymentManager } from "@/app/hq-kawalees/payment-manager"
import { InviteCenter } from "@/app/hq-kawalees/invite-center"
import { FlashBannerEditor } from "@/app/hq-kawalees/flash-banner-editor"

type HqTab = "overview" | "payments" | "invites" | "banner"

const TABS: { id: HqTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "نظرة عامة", icon: Activity },
  { id: "payments", label: "وسائل الدفع", icon: CreditCard },
  { id: "invites", label: "الأكواد والتوثيق", icon: KeyRound },
  { id: "banner", label: "نشرة التنبيهات", icon: Megaphone },
]

/** غرفة عمليات كواليس: تحكم ديناميكي في الدفع، الأكواد، التوثيق، والنشرات. */
export function HqDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<HqTab>("overview")
  const tickets = useTickets()
  const methods = usePaymentMethods()
  const codes = useInviteCodes()
  const entities = useVerifiedEntities()
  const reviews = useReviews()
  const banner = useFlashBanner()

  const stats = useMemo(() => {
    const codeStats = inviteCodeStats(codes)
    return [
      { label: "إجمالي التذاكر", value: String(tickets.length), hint: "من مخزن المنصة" },
      { label: "حضور عند البوابة", value: String(tickets.filter((ticket) => ticket.status === "checked_in").length), hint: "تذاكر مسحت فعلًا" },
      { label: "وسائل دفع مفعّلة", value: String(methods.filter((method) => method.isActive).length), hint: `من ${methods.length} وسيلة` },
      { label: "أكواد متاحة", value: String(codeStats.available), hint: `${codeStats.used} مستعمل` },
      { label: "كيانات موثقة", value: String(entities.length), hint: "شارات ذهبية/زرقاء" },
      { label: "تقييمات موثقة", value: String(reviews.length), hint: "من جمهور حضر فعلًا" },
    ]
  }, [codes, entities.length, methods, reviews.length, tickets])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-bold">غرفة عمليات كواليس</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              مرحبًا {adminName} — تحكم مباشر في كل مفاصل المنصة (صلاحيات Superadmin).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn("rounded-full px-3 py-1 font-semibold", banner.enabled ? "bg-amber-500/20 text-amber-200" : "bg-secondary/40 text-muted-foreground")}>
            {banner.enabled ? "نشرة تنبيه ظاهرة" : "لا نشرة تنبيه"}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-secondary/40 px-3 py-1 text-muted-foreground">
            <Ticket className="h-3 w-3" />
            {tickets.length} تذكرة
          </span>
          <span className="flex items-center gap-1 rounded-full bg-secondary/40 px-3 py-1 text-muted-foreground">
            <BadgeCheck className="h-3 w-3" />
            {entities.length} موثق
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                tab === item.id ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((card) => (
            <div key={card.label} className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-1 font-serif text-2xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "payments" && <PaymentManager />}
      {tab === "invites" && <InviteCenter />}
      {tab === "banner" && <FlashBannerEditor />}
    </div>
  )
}
