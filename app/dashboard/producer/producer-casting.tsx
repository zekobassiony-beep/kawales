"use client"

import { useMemo } from "react"
import { MessageCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  APPLICATION_BADGES,
  derivedAge,
  whatsappLink,
  type ProducerApplicationStatus,
} from "@/lib/producer-metrics"
import { setApplicationStatus, useWorkspace, type ApplicationStatus } from "@/lib/productions"

/** طلبات الكاستينج: كروت المتقدمين + تغيير الحالة بنقرة + تواصل عبر واتساب. */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"
const BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
const STATUSES: ProducerApplicationStatus[] = ["pending", "shortlist", "second_round", "rejected"]

export function ProducerCasting() {
  const workspace = useWorkspace()
  const applications = useMemo(() => workspace.applications, [workspace.applications])

  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
          <Sparkles className="h-4 w-4 text-amber-400" />
          طلبات الكاستينج والانضمام
        </h3>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-300">
          {applications.filter((item) => item.status === "pending").length} طلب جديد
        </span>
      </div>

      {applications.length === 0 ? (
        <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center text-xs text-zinc-500">
          لا توجد طلبات تقديم بعد — انشر أوديشنًا من لوحة الفرقة لتصلك الطلبات هنا.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {applications.map((application) => {
            const badge = APPLICATION_BADGES[application.status as ProducerApplicationStatus] ?? APPLICATION_BADGES.pending
            return (
              <div key={application.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 font-serif text-lg font-bold text-amber-400">
                      {application.actorName.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{application.actorName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {derivedAge(application.actorEmail)} سنة · {application.auditionId}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>

                <a
                  href={application.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate font-mono text-[10px] text-sky-300 hover:underline"
                  dir="ltr"
                >
                  {application.profileUrl}
                </a>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setApplicationStatus(application.id, status as ApplicationStatus)}
                      className={cn(
                        BTN,
                        application.status === status
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                          : "border-zinc-800 text-zinc-300 hover:bg-zinc-800/60",
                      )}
                    >
                      {APPLICATION_BADGES[status].label}
                    </button>
                  ))}
                  <a
                    href={whatsappLink("01000000000", `مرحبًا ${application.actorName}، بخصوص تقديمك في كواليس…`)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    تواصل عبر واتساب
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
