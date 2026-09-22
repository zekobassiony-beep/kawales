"use client"

import { useRef } from "react"
import { Check, X } from "lucide-react"
import { compressImageFile } from "@/components/avatar-picker"
import { cn } from "@/lib/utils"
import type { Production, SeatingMode, TicketTier } from "@/lib/productions"

/** حقول وشارات مشتركة بين خطوات نموذج إضافة العمل المسرحي. */

export const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

export const IMAGE_ACCEPT = "image/*"

export type StepTwoDraft = {
  venue: string | null
  tiers: TicketTier[]
  seatingMode: SeatingMode
  rows: number
  seatsPerRow: number
  blockedSeats: string[]
  capacity: number
  sold: number
  gallery: string[]
}

export function showStatusTone(status: Production["status"]): "green" | "amber" | "red" | "gray" {
  return status === "on_sale" ? "green" : status === "coming_soon" ? "amber" : "gray"
}

export function StepPill({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/10 text-primary-foreground"
          : done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-border/60 text-muted-foreground",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary/70 text-[10px] font-bold">
        {done ? <Check className="h-3 w-3" /> : index}
      </span>
      {label}
    </span>
  )
}

/** رافع صور مُعيد رابط data-URL مضغوط — يُستعمل للبوستر ومعرض الصور. */
export function useFilePicker(onPick: (url: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const url = await compressImageFile(file)
      onPick(url)
    } catch {
      alert("تعذر قراءة الصورة.")
    } finally {
      event.target.value = ""
    }
  }
  return { inputRef, onPickFile }
}

export function PosterField({
  url,
  onChange,
  label,
  icon,
}: {
  url: string
  onChange: (url: string) => void
  label: string
  icon: React.ReactNode
}) {
  const { inputRef, onPickFile } = useFilePicker(onChange)
  return (
    <div className="mt-1 space-y-2">
      {url ? (
        <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border border-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="إزالة الصورة"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border border-background/60 bg-background/70 text-muted-foreground hover:bg-destructive/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex h-28 w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
          <input type="file" ref={inputRef} accept={IMAGE_ACCEPT} onChange={onPickFile} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} className="underline">
            أو ارفع صورة
          </button>
        </div>
      )}
    </div>
  )
}