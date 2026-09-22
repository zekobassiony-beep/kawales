"use client"

import { useTransition } from "react"
import { toggleOffPeakDeal } from "@/app/dashboard/actions"
import type { OffPeakDeal } from "@/lib/dashboards"

/** مفتاح تفعيل/إيقاف خصم أيام الركود. */
export function OffPeakToggle({ deal }: { deal: OffPeakDeal }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={deal.active}
      aria-label={`تفعيل خصم ${deal.days}`}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleOffPeakDeal(deal.id, !deal.active)
        })
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        deal.active ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          deal.active ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  )
}