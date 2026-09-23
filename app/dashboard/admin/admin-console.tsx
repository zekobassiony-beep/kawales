"use client"

import { useState } from "react"
import Link from "next/link"
import { Activity, ArrowUpRight, DoorOpen, ShieldCheck, Ticket, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useServerTickets } from "@/components/use-server-tickets"
import { AdminUsersManager } from "@/app/dashboard/admin/admin-users-manager"
import { HQ_PATH } from "@/lib/roles"

type AdminTab = "overview" | "admins"

const TABS: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "نظرة عامة", icon: Activity },
  { id: "admins", label: "إدارة الأدمنز", icon: Users },
]

/** لوحة السوبر أدمن: نظرة عامة حيّة من Supabase + إدارة المسؤولين. */
export function AdminConsole({
  emails,
  tableReady,
  adminEmail,
  isMaster,
}: {
  emails: string[]
  tableReady: boolean
  adminEmail: string
  isMaster: boolean
}) {
  const [tab, setTab] = useState<AdminTab>("overview")
  const { tickets, loading } = useServerTickets()

  const stats = [
    { label: "إجمالي الحجوزات", value: String(tickets.length), hint: "من جدول tickets على Supabase" },
    { label: "مقبولة (QR فعّال)", value: String(tickets.filter((t) => t.status === "approved").length), hint: "جاهزة للبوابة" },
    { label: "بانتظار المراجعة", value: String(tickets.filter((t) => t.status === "pending").length), hint: "إيصالات قيد التحقق" },
    { label: "حضور عند البوابة", value: String(tickets.filter((t) => t.status === "checked_in").length), hint: "تذاكر مسحت فعلًا" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-bold">لوحة السوبر أدمن</h1>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {adminEmail}
              {isMaster ? " — Master Admin" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Link
            href={HQ_PATH}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <DoorOpen className="h-3.5 w-3.5" />
            غرفة العمليات
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <span className="flex items-center gap-1 rounded-full bg-secondary/40 px-3 py-1 text-muted-foreground">
            <Ticket className="h-3 w-3" />
            {tickets.length} تذكرة
          </span>
          <span className="flex items-center gap-1 rounded-full bg-secondary/40 px-3 py-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            {emails.length} أدمن
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
                tab === item.id
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((card) => (
              <div key={card.label} className="rounded-xl border border-border/60 bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-1 font-serif text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? "جارٍ تحميل الحجوزات من Supabase…" : "البيانات محدّثة مباشرة من جدول tickets في Supabase."}
          </p>
        </div>
      )}

      {tab === "admins" && (
        <AdminUsersManager initialEmails={emails} tableReady={tableReady} callerEmail={adminEmail} />
      )}
    </div>
  )
}
