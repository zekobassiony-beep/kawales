"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Check, Copy, Phone, Save } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * التقويم اليدوي لمدير المسرح: تحديد الأيام المتاحة/المحجوزة، ونسب الخصم لكل
 * يوم، ومعلومات التواصل المباشر للمخرجين والفرق لطلب حجز القاعة.
 */

const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] as const

type DayConfig = { available: boolean; discount: number }
type ManualSchedule = Record<string, DayConfig>

const STORAGE_KEY = "kawalees:venue-manual-schedule"
const DEFAULT_SCHEDULE: ManualSchedule = Object.fromEntries(
  WEEKDAYS.map((day) => [day, { available: true, discount: 0 }]),
)
const VENUE_CONTACT = { phone: "01000000000", email: "booking@kawalees.test" }

function loadSchedule(): ManualSchedule {
  if (typeof window === "undefined") return DEFAULT_SCHEDULE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SCHEDULE
    const parsed = JSON.parse(raw) as Partial<ManualSchedule>
    const merged: ManualSchedule = { ...DEFAULT_SCHEDULE }
    for (const day of WEEKDAYS) {
      const entry = parsed[day]
      if (entry && typeof entry === "object") {
        merged[day] = {
          available: entry.available !== false,
          discount: Math.min(100, Math.max(0, Number(entry.discount) || 0)),
        }
      }
    }
    return merged
  } catch {
    return DEFAULT_SCHEDULE
  }
}

export function VenueManualCalendar() {
  const [schedule, setSchedule] = useState<ManualSchedule>(DEFAULT_SCHEDULE)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<"phone" | "email" | null>(null)

  useEffect(() => {
    setSchedule(loadSchedule())
  }, [])

  const update = (day: string, patch: Partial<DayConfig>) =>
    setSchedule((current) => ({ ...current, [day]: { ...current[day], ...patch } }))

  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule))
    } catch {
      // تخزين معطّل — نكتفي بالحالة الحالية.
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const copy = async (kind: "phone" | "email") => {
    await navigator.clipboard.writeText(VENUE_CONTACT[kind]).catch(() => undefined)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((day) => {
          const config = schedule[day] ?? { available: true, discount: 0 }
          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                config.available ? "border-border/60 bg-card" : "border-destructive/40 bg-destructive/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-serif text-base font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {day}
                </p>
                <button
                  type="button"
                  onClick={() => update(day, { available: !config.available })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    config.available
                      ? "border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/10"
                      : "border-destructive/60 text-destructive-foreground hover:bg-destructive/20",
                  )}
                >
                  {config.available ? "متاح" : "محجوز"}
                </button>
              </div>
              <label className="mt-3 block text-xs text-muted-foreground">
                نسبة الخصم
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.discount}
                  onChange={(event) => update(day, { discount: Number(event.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
              {config.discount > 0 && (
                <p className="mt-2 text-[11px] text-amber-300">خصم {config.discount}% على حجوزات هذا اليوم</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم حفظ التقويم" : "حفظ الأيام والخصومات"}
        </button>
        <span className="text-xs text-muted-foreground">
          أيام متاحة: {WEEKDAYS.filter((day) => schedule[day]?.available).length} / {WEEKDAYS.length}
        </span>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Phone className="h-4 w-4 text-primary" />
          حجز القاعة — تواصل مباشر
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          يطّلع المخرجون والفرق على جدول الأيام أعلاه ويتواصلون مع إدارة المسرح مباشرة لتأكيد حجز القاعة وتحديد الموعد النهائي.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => copy("phone")}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 font-semibold transition-colors hover:bg-secondary"
          >
            <Phone className="h-3.5 w-3.5 text-primary" />
            <span dir="ltr">{VENUE_CONTACT.phone}</span>
            {copied === "phone" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={() => copy("email")}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 font-semibold transition-colors hover:bg-secondary"
          >
            <span dir="ltr" className="font-mono text-xs">{VENUE_CONTACT.email}</span>
            {copied === "email" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
      </div>
    </div>
  )
}

