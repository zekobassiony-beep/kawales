"use client"

import { useState, useTransition } from "react"
import { ScanLine } from "lucide-react"
import { verifyTicket } from "@/app/dashboard/actions"

/** ماسح تذاكر البوابة: إدخال المرجع والتحقق الفوري من صيغته. */
export function TicketScanner() {
  const [pending, startTransition] = useTransition()
  const [reference, setReference] = useState("")
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        <ScanLine className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="اكتب مرجع التذكرة هنا… مثال: KW-ABC123"
          dir="ltr"
          className="w-full bg-transparent text-left font-mono text-sm uppercase text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="button"
        disabled={pending || !reference.trim()}
        onClick={() => {
          setNotice(null)
          startTransition(async () => {
            const result = await verifyTicket(reference)
            setNotice(
              result.ok
                ? { ok: true, text: result.message ?? "التذكرة صالحة." }
                : { ok: false, text: result.error ?? "التذكرة غير صالحة." },
            )
          })
        }}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "جارٍ التحقق…" : "تحقق من التذكرة"}
      </button>
      {notice && (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm font-medium ${
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  )
}