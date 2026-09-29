"use client"

/**
 * أداة التأشير للتطوير (تعمل محليًا فقط):
 * اضغط مفتاح «ألت» مع زر الفأرة على أي عنصر في الصفحة ⇒ تُرسل الأداة تفاصيل العنصر
 * إلى مسار محلي يحدّد الملف ورقم السطر، ويُسجّل العملية في ملف داخل المشروع.
 *
 * لا تصل هذه الأداة إلى النسخة المنشورة (تُحمَّل من ملف التصميم العام بشرط وضع التطوير).
 */
import { useCallback, useEffect, useRef, useState } from "react"

type Candidate = { file: string; line: number; score: number; snippet: string }
type InspectResponse = { ok?: boolean; best?: Candidate | null; candidates?: Candidate[]; tokens?: string[] }

/** تفاصيل العنصر التي تُرسل للسيرفر. */
type Capture = {
  page: string
  tag: string
  id: string
  className: string
  text: string
  href: string
  selector: string
  rect: { width: number; height: number; top: number; left: number }
  react: { components: string[]; source: { fileName: string; lineNumber: number } | null } | null
}

type Status =
  | { kind: "idle"; message: string }
  | { kind: "busy"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "fail"; message: string }

/** يبني مسارًا تسلسليًا للعنصر داخل الصفحة (حتى ٨ مستويات) للاسترشاد. */
function buildSelector(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element
  let depth = 0

  while (current && depth < 8) {
    const tag = current.tagName.toLowerCase()
    const parent: Element | null = current.parentElement
    let part = tag

    if (current.id) {
      part += `#${current.id}`
      parts.unshift(part)
      break
    }
    if (parent) {
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === current?.tagName)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
    }

    parts.unshift(part)
    current = parent
    depth += 1
  }

  return parts.join(" > ")
}

/** يقرأ معلومات مكوّنات التفاعل من العنصر إن كانت متاحة (مكسب إضافي، بلا اعتماد عليه). */
function readReactInfo(element: Element): Capture["react"] {
  try {
    const record = element as unknown as Record<string, unknown>
    const fiberKey = Object.keys(record).find(
      (key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"),
    )
    if (!fiberKey) return null

    const components: string[] = []
    let source: { fileName: string; lineNumber: number } | null = null
    let node = record[fiberKey] as Record<string, unknown> | null
    let depth = 0

    while (node && depth < 32) {
      const type = node.type as { displayName?: string; name?: string } | string | undefined
      const name = typeof type === "string" ? type : type?.displayName ?? type?.name
      if (name && !components.includes(name)) components.push(name)

      const debugSource = node._debugSource as { fileName?: string; lineNumber?: number } | undefined
      if (!source && debugSource?.fileName) {
        source = { fileName: debugSource.fileName, lineNumber: debugSource.lineNumber ?? 0 }
      }

      node = (node.return as Record<string, unknown> | null) ?? null
      depth += 1
    }

    return { components: components.slice(0, 6), source }
  } catch {
    return null
  }
}

/** يجمع تفاصيل العنصر المطلوب تعديله. */
function captureElement(element: Element): Capture {
  const htmlElement = element as HTMLElement
  const rect = htmlElement.getBoundingClientRect?.() ?? { width: 0, height: 0, top: 0, left: 0 }
  const text = (htmlElement.innerText ?? htmlElement.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160)

  return {
    page: `${window.location.pathname}${window.location.search}`,
    tag: element.tagName.toLowerCase(),
    id: element.id ?? "",
    className: typeof htmlElement.className === "string" ? htmlElement.className : "",
    text,
    href: element.getAttribute("href") ?? element.getAttribute("src") ?? "",
    selector: buildSelector(element),
    rect: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
    },
    react: readReactInfo(element),
  }
}

/** لوحة الأداة: زر تفعيل/إيقاف + شريط نتيجة آخر تأشير. */
export function DevInspector() {
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" })
  const enabledRef = useRef(enabled)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  /** يرسل تفاصيل العنصر إلى المسار المحلي ويعرض النتيجة. */
  const submit = useCallback(async (element: Element) => {
    const capture = captureElement(element)
    setStatus({ kind: "busy", message: "جارٍ تحديد مكان العنصر…" })

    try {
      const response = await fetch("/api/dev/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(capture),
      })

      if (!response.ok) {
        setStatus({
          kind: "fail",
          message:
            response.status === 404
              ? "المسار المحلي غير مفعّل (يعمل في وضع التطوير فقط)."
              : `فشل التأشير (رمز الاستجابة ${response.status}).`,
        })
        return
      }

      const data = (await response.json()) as InspectResponse
      const best = data.best
      if (!best) {
        setStatus({
          kind: "fail",
          message: "تم تسجيل العنصر، لكن لم يُحدَّد الملف تلقائيًا — سنحدّده من ملف السجل.",
        })
        return
      }

      const label = `${best.file}:${best.line}`
      void navigator.clipboard?.writeText(label).catch(() => undefined)
      setStatus({ kind: "ok", message: `تم التسجيل ← ${label} (ونُسخ للحافظة)` })
    } catch (error) {
      setStatus({
        kind: "fail",
        message: `تعذّر الإرسال: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      })
    }
  }, [])

  // التقاط الضغطات: ألت + زر الفأرة، في مرحلة الالتقاط لمنع فتح الروابط وإرسال النماذج.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!enabledRef.current || !event.altKey) return
      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest("[data-dev-inspector]")) return

      event.preventDefault()
      event.stopPropagation()
      void submit(target)
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [submit])

  // إخفاء شريط النتيجة تلقائيًا بعد ٨ ثوانٍ.
  useEffect(() => {
    if (status.kind !== "ok" && status.kind !== "fail") return
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setStatus({ kind: "idle", message: "" }), 8000)
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [status])

  const palette = {
    ok: { background: "#052e16", border: "#34d399", color: "#a7f3d0" },
    fail: { background: "#450a0a", border: "#f87171", color: "#fecaca" },
    busy: { background: "#111827", border: "#60a5fa", color: "#dbeafe" },
    idle: { background: "transparent", border: "transparent", color: "transparent" },
  }[status.kind]

  return (
    <div
      data-dev-inspector
      dir="rtl"
      style={{
        position: "fixed",
        insetInlineStart: "0.75rem",
        bottom: "0.75rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "0.5rem",
        maxWidth: "24rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        title="اضغط لتفعيل/إيقاف وضع التأشير"
        style={{
          cursor: "pointer",
          borderRadius: "999px",
          border: `1px solid ${enabled ? "#f59e0b" : "#52525b"}`,
          background: enabled ? "rgba(245, 158, 11, 0.15)" : "rgba(24, 24, 27, 0.9)",
          color: enabled ? "#fcd34d" : "#a1a1aa",
          padding: "0.35rem 0.75rem",
          fontSize: "11px",
          fontWeight: 600,
          direction: "rtl",
        }}
      >
        {enabled ? "وضع التأشير: مفعّل (ألت + ضغطة على أي عنصر)" : "وضع التأشير: متوقف"}
      </button>

      {status.kind !== "idle" && (
        <p
          role="status"
          style={{
            margin: 0,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            color: palette.color,
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            fontSize: "12px",
            lineHeight: 1.7,
            direction: "rtl",
            textAlign: "right",
          }}
        >
          {status.message}
        </p>
      )}
    </div>
  )
}

