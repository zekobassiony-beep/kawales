"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CameraOff, Loader2, ScanLine } from "lucide-react"
import jsQR from "jsqr"
import { cn } from "@/lib/utils"

/**
 * قارئ رمز QR بالكاميرا (بوابة المسرح).
 *
 * يعمل بمسارين:
 *  1) `BarcodeDetector` الأصلي في المتصفح (أندرويد/كروم) — الأسرع والأخف.
 *  2) وإلا: تفكيك الرمز في المتصفح بمكتبة `jsqr` (يغطّي سفاري/آيفون).
 *
 * ملاحظات تشغيلية:
 *  - يحتاج **HTTPS** (أو localhost) — قيد المتصفح على الكاميرا.
 *  - الكاميرا الخلفية مفضّلة تلقائيًا (`facingMode: environment`).
 *  - نفس الكود لا يُبلَّغ أكثر من مرة خلال `DUPLICATE_WINDOW_MS` لمنع تكرار المسح.
 *  - يُغلق المصدر (المسار/الكاميرا) كاملًا عند الإيقاف أو مغادرة الصفحة.
 */

/** نافذة تجاهل تكرار نفس الرمز (ملي ثانية). */
const DUPLICATE_WINDOW_MS = 4000
/** الفاصل بين محاولات القراءة (ملي ثانية) — 5 محاولات في الثانية كافية. */
const SCAN_INTERVAL_MS = 200
/** أقصى عرض لإطار التحليل (تصغير الإطار يقصّر زمن فك الرمز على الهاتف). */
const ANALYSIS_MAX_WIDTH = 640

/** واجهة مختصرة لمكتشف الباركود الأصلي (غير مُعرَّف في أنواع المتصفح القياسية). */
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

/** يحضر `BarcodeDetector` إن كان مدعومًا في هذا المتصفح. */
function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const candidate = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return typeof candidate === "function" ? candidate : null
}

export function QrCameraScanner({
  active,
  onDetected,
  className,
}: {
  /** تشغيل/إيقاف الكاميرا (يتحكم به زر الماسح). */
  active: boolean
  /** يُستدعى مرة لكل رمز مقروء (بعد تجاهل التكرار). */
  onDetected: (raw: string) => void
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastCodeRef = useRef<{ value: string; at: number }>({ value: "", at: 0 })
  const onDetectedRef = useRef(onDetected)
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "error">("idle")
  const [error, setError] = useState("")

  // نُبقي أحدث نسخة من المُعالج بلا إعادة تشغيل الكاميرا عند تغيّر الدالة.
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  /** يمنع تكرار نفس الكود في نافذة زمنية قصيرة (الكاميرا ترى الرمز عشرات المرات). */
  const shouldReport = useCallback((value: string): boolean => {
    const now = Date.now()
    const last = lastCodeRef.current
    if (last.value === value && now - last.at < DUPLICATE_WINDOW_MS) return false
    lastCodeRef.current = { value, at: now }
    return true
  }, [])

  /** يوقف الكاميرا وينظّف كل الموارد (يُستدعى عند الإيقاف أو التفكيك). */
  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    setStatus("idle")
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      return
    }

    let cancelled = false

    /** يحلّل إطارًا واحدًا (بالماسح الأصلي إن توفّر، وإلا بمكتبة jsqr). */
    const analyzeFrame = async (detector: BarcodeDetectorLike | null): Promise<void> => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      if (detector) {
        try {
          const found = await detector.detect(video)
          const value = found[0]?.rawValue?.trim() ?? ""
          if (value && shouldReport(value)) onDetectedRef.current(value)
        } catch {
          // خطأ عابر في إطار واحد — نتجاهله ونكمل الإطار التالي.
        }
        return
      }

      const width = video.videoWidth
      const height = video.videoHeight
      if (width === 0 || height === 0) return
      const scale = Math.min(1, ANALYSIS_MAX_WIDTH / width)
      const targetWidth = Math.max(1, Math.round(width * scale))
      const targetHeight = Math.max(1, Math.round(height * scale))

      let canvas = canvasRef.current
      if (!canvas) {
        canvas = document.createElement("canvas")
        canvasRef.current = canvas
      }
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) return
      context.drawImage(video, 0, 0, targetWidth, targetHeight)
      const frame = context.getImageData(0, 0, targetWidth, targetHeight)
      const decoded = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })
      const value = decoded?.data?.trim() ?? ""
      if (value && shouldReport(value)) onDetectedRef.current(value)
    }

    const run = async (): Promise<void> => {
      setStatus("starting")
      setError("")

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error")
        setError("المتصفح لا يدعم الكاميرا — استخدم الإدخال اليدوي بالأسفل.")
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop()
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setStatus("live")

        let detector: BarcodeDetectorLike | null = null
        const Detector = getBarcodeDetectorCtor()
        if (Detector) {
          try {
            detector = new Detector({ formats: ["qr_code"] })
          } catch {
            detector = null
          }
        }

        let lastAttempt = 0
        const loop = (timestamp: number): void => {
          if (cancelled) return
          if (timestamp - lastAttempt >= SCAN_INTERVAL_MS) {
            lastAttempt = timestamp
            void analyzeFrame(detector)
          }
          frameRef.current = window.requestAnimationFrame(loop)
        }
        frameRef.current = window.requestAnimationFrame(loop)
      } catch (cause) {
        const name = cause instanceof Error ? cause.name : ""
        setStatus("error")
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("لم يُسمح باستخدام الكاميرا — اسمح بالوصول من إعدادات المتصفح ثم أعد المحاولة.")
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("لم نجد كاميرا متاحة على هذا الجهاز — استخدم الإدخال اليدوي.")
        } else {
          setError("تعذّر تشغيل الكاميرا — تأكد أن الموقع يعمل بـ HTTPS وأن الكاميرا غير مستخدمة في تطبيق آخر.")
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      stop()
    }
  }, [active, shouldReport, stop])

  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-primary" />
          ماسح الكاميرا
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {status === "live" ? "وجّه الكاميرا نحو رمز التذكرة" : status === "starting" ? "جارٍ التشغيل…" : "متوقف"}
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-lg border border-border/60 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn("block h-56 w-full object-cover", status !== "live" && "opacity-40")}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
        />
        {status === "starting" && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
            <Loader2 className="me-2 h-4 w-4 animate-spin" /> جارٍ تشغيل الكاميرا…
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          <CameraOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
