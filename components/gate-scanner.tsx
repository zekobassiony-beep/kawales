"use client"

import { useCallback, useMemo, useState } from "react"
import { AlertTriangle, Camera, CheckCircle2, History, ScanLine, Ticket as TicketIcon, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { QrCameraScanner } from "@/components/qr-camera-scanner"
import { checkInTicketServer } from "@/app/actions/tickets"
import { parseTicketCode } from "@/lib/ticket-code"
import {
  applyServerTicketUpdate,
  checkInTicket,
  formatCheckInTime,
  scannableTickets,
  useTickets,
  type CheckInOutcome,
  type CheckInResult,
  type Ticket,
} from "@/lib/tickets"

/**
 * ماسح تذاكر البوابة (Gate Check-in):
 *  - إدخال يدوي سريع لكود التذكرة `KW-XXXXXX` + محاكاة ماسح كاميرا الـ QR.
 *  - تغذية بصرية (أخضر/أحمر/أصفر) وسمعية (نغمة قبول أو صافرة تنبيه).
 *  - سجل آخر عمليات المسح مع تفاصيل كل حالة.
 */

type ScanEntry = { code: string; outcome: CheckInOutcome; at: string }

const OUTCOME_TONES: Record<CheckInOutcome, { panel: string; label: string; icon: typeof CheckCircle2 }> = {
  accepted: {
    panel: "border-emerald-500/50 bg-emerald-500/15 text-emerald-100",
    label: "تم تسجيل الدخول بنجاح",
    icon: CheckCircle2,
  },
  already_used: {
    panel: "border-destructive/60 bg-destructive/20 text-destructive-foreground",
    label: "تذكرة مستخدمة مسبقًا",
    icon: XCircle,
  },
  not_verified: {
    panel: "border-amber-500/50 bg-amber-500/15 text-amber-100",
    label: "غير معتمدة / بانتظار الدفع",
    icon: AlertTriangle,
  },
  not_found: {
    panel: "border-amber-500/50 bg-amber-500/15 text-amber-100",
    label: "تذكرة غير موجودة",
    icon: AlertTriangle,
  },
}

/** تغذية سمعية فورية: نغمة قبول صاعدة أو صافرة رفض. */
function playFeedback(outcome: CheckInOutcome): void {
  if (typeof window === "undefined") return
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return
  try {
    const context = new AudioContextCtor()
    const accepted = outcome === "accepted"
    const tones = accepted ? [880, 1320] : [220, 180]
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startAt = context.currentTime + index * 0.16
      oscillator.type = accepted ? "sine" : "square"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.15)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.16)
    })
    window.setTimeout(() => {
      void context.close().catch(() => undefined)
    }, 600)
  } catch {
    // الصوت اختياري: نتجاهل أي حظر من سياسة المتصفح.
  }
}


export function GateScanner() {
  const tickets = useTickets()
  const [code, setCode] = useState("")
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [history, setHistory] = useState<ScanEntry[]>([])
  /** حالة الكاميرا (مفتوحة/مغلقة) وتنبيه فشل الوصول للسيرفر. */
  const [cameraOn, setCameraOn] = useState(false)
  const [serverNotice, setServerNotice] = useState("")

  const scannable = useMemo(() => scannableTickets(), [tickets])
  const handled = useMemo(() => tickets.filter((ticket) => ticket.status === "checked_in"), [tickets])

  const runCheckIn = useCallback(async (rawCode: string) => {
    const reference = parseTicketCode(rawCode) || rawCode.trim().toUpperCase()
    if (reference.length === 0) return
    setCode("")

    /** يضيف العملية إلى سجل الشاشة (آخر ٦ عمليات). */
    const record = (outcome: CheckInOutcome) =>
      setHistory((current) => [
        { code: reference, outcome, at: new Date().toISOString() },
        ...current.slice(0, 5),
      ])

    // (1) السيرفر أولًا: مصدر الحقيقة، ومنع التكرار ذرّي بين كل أجهزة البوابة.
    try {
      const remote = await checkInTicketServer(rawCode)
      // «فشل تقني» فقط (شبكة/قاعدة) ⇒ نسقط للتخزين المحلي بلا إظهار رفض كاذب.
      const technicalFailure =
        remote.outcome === "not_found" && Boolean(remote.error) && remote.error !== "invalid_code"

      if (!technicalFailure) {
        if (remote.ticket) {
          // نُحدّث النسخة المحلية بما حسمه السيرفر (يظهر فورًا في العميل بلا إعادة تحميل).
          applyServerTicketUpdate({
            id: remote.ticket.id,
            status: remote.ticket.status,
            checkedInAt: remote.checkedInAt ?? null,
            ticketImageUrl: remote.ticket.ticketImageUrl ?? null,
          })
        }
        setServerNotice("")
        setResult({
          outcome: remote.outcome,
          ticket: remote.ticket,
          message: remote.message,
          checkedInAt: remote.checkedInAt,
        })
        playFeedback(remote.outcome)
        record(remote.outcome)
        return
      }

      setServerNotice(remote.message)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      setServerNotice(`تعذّر الوصول إلى السيرفر (${reason}) — تم التحقق محليًا على هذا الجهاز فقط.`)
    }

    // (2) بديل محلي: تبقى البوابة تعمل لو انقطعت الشبكة (تسجيل على هذا الجهاز فقط).
    const outcome = checkInTicket(reference)
    setResult(outcome)
    playFeedback(outcome.outcome)
    record(outcome.outcome)
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <label htmlFor="gate-code" className="flex items-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-primary" />
          فحص تذكرة عند البوابة
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="gate-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runCheckIn(code)
            }}
            placeholder="KW-XXXXXX"
            dir="ltr"
            autoComplete="off"
            className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-left font-mono text-sm uppercase outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            disabled={code.trim().length === 0}
            onClick={() => void runCheckIn(code)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            تحقق وسجّل الحضور
          </button>
          <button
            type="button"
            onClick={() => setCameraOn((value) => !value)}
            aria-pressed={cameraOn}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
              cameraOn
                ? "border-destructive/50 bg-destructive/10 text-destructive-foreground hover:bg-destructive/20"
                : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <Camera className={cn("h-3.5 w-3.5", cameraOn && "animate-pulse")} />
            {cameraOn ? "إيقاف الكاميرا" : "مسح بكاميرا الجهاز 📷"}
          </button>
        </div>

        {cameraOn && (
          <QrCameraScanner
            active={cameraOn}
            onDetected={(raw) => void runCheckIn(raw)}
            className="mt-4 bg-background/40"
          />
        )}

        {serverNotice && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {serverNotice}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          التذاكر الجاهزة للمسح الآن: <span className="font-bold text-foreground">{scannable.length}</span> · تم تسجيل
          حضورها سابقًا: <span className="font-bold text-foreground">{handled.length}</span>
        </p>
      </div>

      {result && <ScanResultPanel result={result} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <QuickPick tickets={scannable} onPick={(value) => void runCheckIn(value)} />
        <ScanHistory entries={history} />
      </div>
    </div>
  )
}

/** لوحة النتيجة الملوّنة: أخضر مقبول / أحمر مستخدم مسبقًا / أصفر غير صالح. */
function ScanResultPanel({ result }: { result: CheckInResult }) {
  const tone = OUTCOME_TONES[result.outcome]
  const Icon = tone.icon
  const ticket = result.ticket

  return (
    <div role="status" className={cn("rounded-xl border p-5", tone.panel)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-bold">{tone.label}</p>
          <p className="mt-1 text-xs opacity-90">{result.message}</p>

          {result.checkedInAt && (
            <p className="mt-1 text-[11px] opacity-90">وقت الحضور: {formatCheckInTime(result.checkedInAt)}</p>
          )}

          {ticket && (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Row label="العرض" value={ticket.showTitle} />
              <Row label="الحاضر" value={ticket.customerName} />
              <Row label="المقاعد" value={ticket.seats.join("، ")} />
              <Row label="الفئة" value={ticket.tierName} />
              <Row label="المسرح" value={ticket.venue} />
              <Row label="الكود" value={ticket.id} mono />
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className={cn("truncate font-medium", mono && "font-mono")} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  )
}

/** قائمة سريعة بالتذاكر الجاهزة لتسهيل تجربة المسح عند البوابة. */
function QuickPick({ tickets, onPick }: { tickets: Ticket[]; onPick: (code: string) => void }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <TicketIcon className="h-4 w-4 text-primary" />
        تذاكر جاهزة للمسح
      </h3>
      {tickets.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          لا تذاكر معتمدة بانتظار المسح — أكمل حجزًا واعتمده عبر البوت أولًا.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {tickets.slice(0, 5).map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onPick(ticket.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-right transition-colors hover:bg-secondary"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{ticket.showTitle}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {ticket.customerName} · {ticket.seats.join("، ")}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-primary">{ticket.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** سجل آخر عمليات المسح في هذه الجلسة. */
function ScanHistory({ entries }: { entries: ScanEntry[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-primary" />
        سجل المسح (آخر 6)
      </h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">لم تُجرَ أي عملية مسح بعد.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.code + entry.at} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-mono" dir="ltr">
                {entry.code}
              </span>
              <span className="text-muted-foreground">{formatCheckInTime(entry.at)}</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  OUTCOME_TONES[entry.outcome].panel,
                )}
              >
                {OUTCOME_TONES[entry.outcome].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
