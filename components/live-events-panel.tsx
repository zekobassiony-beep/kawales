"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, CalendarDays, MapPin, Mic, Sparkles } from "lucide-react"
import { StatusBadge } from "@/app/dashboard/ui"
import { SHOW_STATUS_LABELS, useWorkspace, type Production } from "@/lib/productions"
import type { EventWithRelations } from "@/lib/queries"

/**
 * لوحات تعرض البيانات الحيّة من مساحة عمل الفرق (`lib/productions`)
 * مدمجة مع بيانات العروض من قاعدة البيانات — فتظهر أي شو/أودشن يُنشأ
 * من لوحة الفرقة فورًا في الشاشة الرئيسية وصفحة العروض.
 */

/** يطبّع اسم العرض لمطابقة عروض مساحة عمل الفرقة بعروض قاعدة البيانات بالعنوان. */
function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function LiveShowsGrid({ events = [] }: { events?: EventWithRelations[] }) {
  const workspace = useWorkspace()
  const productions = workspace.productions

  const slugByTitle = new Map<string, string>()
  for (const event of events) slugByTitle.set(normalizeTitle(event.title), event.slug)

  if (productions.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {productions.map((production) => (
        <LiveShowCard
          key={production.id}
          production={production}
          slug={slugByTitle.get(normalizeTitle(production.title))}
        />
      ))}
    </div>
  )
}

/** كارت عرض الفرقة — الكارت بالكامل قابل للضغط مع زر «تصفح الآن» الواضح. */
function LiveShowCard({ production, slug }: { production: Production; slug?: string }) {
  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={production.posterUrl || "/placeholder.svg"}
          alt={`بوستر ${production.title}`}
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-medium text-foreground backdrop-blur">
          من الفرق مباشرة
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          عرض جديد
        </p>
        <h3 className="mt-1 font-serif text-lg font-semibold leading-tight">{production.title}</h3>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {production.venue ?? "يحدد لاحقاً"}
        </p>
        <div className="mt-3 border-t border-border/60 pt-3">
          <StatusBadge tone={production.status === "on_sale" ? "green" : production.status === "coming_soon" ? "amber" : "gray"}>
            {SHOW_STATUS_LABELS[production.status]}
          </StatusBadge>
        </div>
        {slug && (
          <span className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
            تصفح الآن
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </>
  )

  if (!slug) {
    return (
      <article className="flex flex-col overflow-hidden rounded-xl border border-primary/25 bg-card">{body}</article>
    )
  }

  return (
    <Link
      href={`/shows/${slug}`}
      aria-label={`عرض تفاصيل ${production.title}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-primary/25 bg-card transition-all hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {body}
    </Link>
  )
}

export function LiveAuditionsList() {
  const workspace = useWorkspace()
  const auditions = workspace.auditions
  if (auditions.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {auditions.map((audition) => (
        <article
          key={audition.id}
          className="flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-4 w-4" />
            </span>
            <StatusBadge tone={audition.status === "open" ? "green" : "gray"}>
              {audition.status === "open" ? "مفتوح" : "مغلق"}
            </StatusBadge>
          </div>
          <h3 className="mt-3 font-serif text-base font-semibold leading-snug">{audition.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">الدور المطلوب: {audition.role}</p>
          <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              {audition.venue}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
              {audition.date}
            </div>
          </dl>
          <p className="mt-3 border-t border-border/60 pt-3 text-xs font-medium">{audition.pay}</p>
        </article>
      ))}
    </div>
  )
}
