"use client"

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { dismissToast, useToasts, type ToastTone } from "@/lib/toast"

const TONES: Record<ToastTone, { box: string; icon: typeof Info }> = {
  success: { box: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100", icon: CheckCircle2 },
  error: { box: "border-destructive/50 bg-destructive/10 text-destructive-foreground", icon: AlertTriangle },
  info: { box: "border-border/70 bg-card text-foreground", icon: Info },
}

/**
 * حاوية الإشعارات — تُركّب مرة واحدة في `app/layout.tsx` فتظهر رسالة نجاح/خطأ
 * لكل عملية في اللوحات (حفظ عمل مسرحي، دعوة طاقم، إغلاق أودشن، …).
 */
export function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => {
        const tone = TONES[toast.tone]
        const Icon = tone.icon
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed shadow-lg backdrop-blur",
              tone.box,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{toast.text}</span>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => dismissToast(toast.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
