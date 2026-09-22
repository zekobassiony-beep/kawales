"use client"

import { Printer } from "lucide-react"
import { cn } from "@/lib/utils"

/** زر طباعة/حفظ PDF بسيط يُشغّل طباعة المتصفح. */
export function PrintButton({ label = "طباعة / حفظ PDF", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary",
        className,
      )}
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
