"use client"

import { useState, useTransition } from "react"

type Action = (formData: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>

/** نموذج سيرفر-أكشن يعرض رسالة نجاح/خطأ بنفس ستايل كواليس. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
}: {
  action: Action
  submitLabel: string
  pendingLabel?: string
  children: React.ReactNode
}) {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setNotice(null)
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await action(formData)
          if (result.ok) {
            setNotice({ ok: true, text: result.message ?? "تم بنجاح." })
            event.currentTarget.reset()
          } else {
            setNotice({ ok: false, text: result.error ?? "تعذّر إتمام العملية." })
          }
        })
      }}
      className="space-y-3"
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (pendingLabel ?? "جارٍ الحفظ…") : submitLabel}
      </button>
      {notice && (
        <p
          role="status"
          className={`rounded-lg border p-3 text-xs ${
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
          }`}
        >
          {notice.text}
        </p>
      )}
    </form>
  )
}

/** حقل إدخال داكن بنفس ستايل نماذج الحجز. */
export function DashboardField({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  required = false,
  min,
  max,
}: {
  id: string
  name: string
  label: string
  defaultValue?: string | number
  type?: string
  placeholder?: string
  required?: boolean
  min?: number
  max?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  )
}

/** بطاقة إحصائية صغيرة للمحفظة والأرقام. */
export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** عنوان قسم داخل اللوحات. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-xl font-semibold">{children}</h2>
}

/** شارة حالة ملوّنة للطلبات والأودشنات. */
export function StatusBadge({ tone, children }: { tone: "green" | "amber" | "red" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    red: "border-destructive/40 bg-destructive/10 text-destructive-foreground",
    gray: "border-border/60 bg-secondary/40 text-muted-foreground",
  }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}