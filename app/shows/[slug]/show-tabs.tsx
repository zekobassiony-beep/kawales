"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Clock, Info, Star, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { findProductionByTitle, useWorkspace } from "@/lib/productions"
import { castRoster, type CastMember } from "@/lib/show-detail"

/**
 * شريط التبويبات الرئيسي لصفحة العرض (التفاصيل · الممثلين · التقييمات)
 * ومعه شبكة كروت الممثلين. المحتوى الثقيل يُمرَّر كمكوّنات جاهزة (children props).
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur"

type TabId = "details" | "cast" | "reviews"

export function ShowTabs({
  details,
  cast,
  reviews,
  castCount,
  reviewCount,
}: {
  details: React.ReactNode
  cast: React.ReactNode
  reviews: React.ReactNode
  castCount: number
  reviewCount: number
}) {
  const [tab, setTab] = useState<TabId>("details")

  const tabs: { id: TabId; label: string; icon: typeof Info; badge?: number }[] = [
    { id: "details", label: "التفاصيل", icon: Info },
    { id: "cast", label: "الممثلين", icon: Users, badge: castCount },
    { id: "reviews", label: "التقييمات", icon: Star, badge: reviewCount },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {tabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">{item.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {tab === "details" && details}
      {tab === "cast" && cast}
      {tab === "reviews" && reviews}
    </div>
  )
}

/** شبكة كروت الممثلين: طاقم الفرقة الحقيقي، ومع غيابه قائمة ثابتة لكل عرض. */
export function ShowCastPanel({ seed }: { seed: string }) {
  const workspace = useWorkspace()

  const cast: CastMember[] = useMemo(() => {
    const production = findProductionByTitle(workspace.productions, seed)
    return castRoster({ seed, crew: production?.crew })
  }, [workspace.productions, seed])

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cast.map((member, index) => (
        <div key={`${member.name}-${index}`} className={cn(CARD, "p-5 text-center transition-colors hover:border-amber-500/30")}>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 font-serif text-2xl font-bold text-amber-400 shadow-[0_0_28px_-12px_rgba(245,158,11,0.95)]">
            {member.initial}
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-100">{member.name}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-zinc-400">
            <Clock className="h-3 w-3" />
            {member.role}
          </p>
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold",
              member.kind === "lead"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-300",
            )}
          >
            <BadgeCheck className="h-3 w-3" />
            {member.kind === "lead" ? "دور رئيسي" : "دور مساعد"}
          </span>
        </div>
      ))}
    </div>
  )
}
