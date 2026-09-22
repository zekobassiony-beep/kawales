"use client"

import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { applyToAudition } from "@/app/dashboard/actions"
import type { Audition } from "@/lib/dashboards"
import { StatusBadge } from "@/app/dashboard/ui"

/** بطاقة أودشن مع زر تقديم بنقرة واحدة. */
export function AuditionCard({ audition }: { audition: Audition }) {
  const [pending, startTransition] = useTransition()
  const [applied, setApplied] = useState(false)

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{audition.troupe}</p>
        <StatusBadge tone={audition.status === "open" ? "green" : "gray"}>
          {audition.status === "open" ? "مفتوح" : "مغلق"}
        </StatusBadge>
      </div>
      <h3 className="mt-2 font-serif text-lg font-semibold">{audition.title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">
        الدور: {audition.role} · {audition.venue}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {audition.date} · {audition.pay}
      </p>
      <button
        type="button"
        disabled={pending || applied || audition.status !== "open"}
        onClick={() => {
          startTransition(async () => {
            const result = await applyToAudition(audition.id)
            if (result.ok) setApplied(true)
          })
        }}
        className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {applied ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            تم التقديم
          </span>
        ) : pending ? (
          "جارٍ الإرسال…"
        ) : (
          "قدّم الآن"
        )}
      </button>
    </div>
  )
}