"use client"

import { useCallback, useState, useTransition } from "react"
import { Camera, CameraOff, CheckCircle2, Clock3, Loader2, ScanLine, Search, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { QrCameraScanner } from "@/components/qr-camera-scanner"
import { checkInTicketServer, type GateCheckInResult } from "@/app/actions/tickets"

/**
 * ماسح تذاكر البوابة داخل لوحة الفرقة:
 *  - **كاميرا حقيقية** تقرأ رمز QR (نفس قارئ بوابة المسرح: BarcodeDetector ثم jsqr).
 *  - **تحقق حقيقي** من قاعدة البيانات عبر `checkInTicketServer` — يمنع استخدام
 *    التذكرة مرتين ويُسجّل وقت الحضور (كان قبل ذلك مجرد فحص لصيغة النص).
 *  - إدخال يدوي للمرجع كبديل عند عدم توفّر الكاميرا.
 *
 * ⚠️ الكاميرا تعمل على HTTPS أو localhost فقط (قيد المتصفحات).
 */

/** نغمة قصيرة للنتيجة (مقبول: عالية · مرفوض: منخفضة) بلا ملفات صوتية. */
function playTone(accepted: boolean): void {
  if (typeof window === "undefined") return
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  try {
    const context = new Ctor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = "sine"
    oscillator.frequency.value = accepted ? 880 : 220
    gain.gain.value = 0.07
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    window.setTimeout(() => {
      try {
        oscillator.stop()
        void context.close()
      } catch {
        // تم إغلاق السياق بالفعل.
      }
    }, accepted ? 160 : 340)
  } catch {
    // المتصفح يمنع الصوت قبل تفاعل المستخدم — نتجاهل.
  }
}

export function TicketScanner() {
  const [cameraOn, setCameraOn] = useState(false)
  const [reference, setReference] = useState("")
  const [result, setResult] = useState<GateCheckInResult | null>(null)
  const [pending, startTransition] = useTransition()

  const runCheckIn = useCallback((raw: string) => {
    const code = (raw ?? "").trim()
    if (code.length === 0) return
    startTransition(async () => {
      const outcome = await checkInTicketServer(code)
      setResult(outcome)
      playTone(outcome.outcome === "accepted")
    })
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setResult(null)
            setCameraOn((value) => !value)
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90",
            cameraOn ? "border border-border/60 bg-secondary/60 text-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {cameraOn ? "إيقاف الكاميرا" : "افتح الكاميرا وامسح التذكرة"}
        </button>
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            جارٍ التحقق من السيرفر…
          </span>
        )}
      </div>

      {/* الكاميرا الحقيقية — تُفتح بإذن المستخدم وتُغلق كاملًا عند الإيقاف. */}
      <QrCameraScanner active={cameraOn} onDetected={(raw) => runCheckIn(raw)} className={cameraOn ? "" : "hidden"} />

      {/* إدخال يدوي كبديل */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2">
          <ScanLine className="h-4 w-4 shrink-0 text-primary" />
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runCheckIn(reference)
            }}
            placeholder="أو اكتب مرجع التذكرة يدويًا… مثال: KW-ABC123"
            dir="ltr"
            className="w-full bg-transparent text-left font-mono text-sm uppercase text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="button"
          disabled={pending || reference.trim().length === 0}
          onClick={() => runCheckIn(reference)}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          تحقق يدويًا
        </button>
      </div>

      {result && (
        <div
          role="status"
          className={cn(
            "rounded-xl border p-4 text-sm",
            result.outcome === "accepted"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : result.outcome === "already_used"
                ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                : "border-destructive/50 bg-destructive/10 text-destructive-foreground",
          )}
        >
          <p className="flex items-start gap-2 font-semibold">
            {result.outcome === "accepted" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : result.outcome === "already_used" ? (
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {result.message}
          </p>

          {result.ticket && (
            <ul className="mt-3 grid gap-1 text-xs">
              <li>
                <span className="opacity-80">التذكرة:</span>{" "}
                <span className="font-mono" dir="ltr">
                  {result.ticket.id}
                </span>
              </li>
              {result.ticket.showTitle && (
                <li>
                  <span className="opacity-80">العرض:</span> {result.ticket.showTitle}
                </li>
              )}
              {result.ticket.customerName && (
                <li>
                  <span className="opacity-80">العميل:</span> {result.ticket.customerName}
                </li>
              )}
              {Array.isArray(result.ticket.seats) && result.ticket.seats.length > 0 && (
                <li>
                  <span className="opacity-80">المقاعد:</span> {result.ticket.seats.join("، ")}
                </li>
              )}
              {result.ticket.tierName && (
                <li>
                  <span className="opacity-80">الفئة:</span> {result.ticket.tierName}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
