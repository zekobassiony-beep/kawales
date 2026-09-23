"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, Loader2, Lock, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { addAdminEmailAction, removeAdminEmailAction } from "@/app/actions/admin"
import { MASTER_ADMIN_EMAIL } from "@/lib/auth-constants"

type Notice = { tone: "ok" | "error"; text: string }

/**
 * «إدارة المسؤولين»: قائمة بريدات لوحة التحكم العليا من جدول `admin_users`
 * على Supabase، مع إضافة أدمن جديد وحذف أدمن — ومنع حذف البريد الأساسي.
 */
export function AdminUsersManager({
  initialEmails,
  tableReady,
  callerEmail,
}: {
  initialEmails: string[]
  tableReady: boolean
  callerEmail: string
}) {
  const [emails, setEmails] = useState<string[]>(initialEmails)
  const [draft, setDraft] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, startTransition] = useTransition()

  const applyResult = (result: { ok: boolean; error?: string; emails?: string[] }) => {
    if (result.ok) {
      if (result.emails) setEmails(result.emails)
      setDraft("")
      setNotice({ tone: "ok", text: "تم تحديث قائمة الأدمنز ✓" })
    } else {
      setNotice({ tone: "error", text: result.error ?? "تعذّرت العملية." })
    }
  }

  const handleAdd = () => {
    setNotice(null)
    startTransition(async () => {
      applyResult(await addAdminEmailAction(draft))
    })
  }

  const handleRemove = (email: string) => {
    setNotice(null)
    startTransition(async () => {
      applyResult(await removeAdminEmailAction(email))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            إدارة الأدمنز
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            البريدات المصرّح لها بالدخول إلى لوحة التحكم العليا (جدول <code className="font-mono">admin_users</code>).
          </p>
        </div>
        <span className="rounded-full bg-secondary/40 px-3 py-1 text-[11px] text-muted-foreground">
          {emails.length} مسؤول
        </span>
      </div>

      {!tableReady && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            جدول <code className="font-mono">admin_users</code> غير متاح بعد — شغّل ملف{" "}
            <code className="font-mono">scripts/admin-users-schema.sql</code> من SQL Editor في Supabase مرة واحدة، ثم
            أعد تحديث الصفحة. البريد الأساسي <span className="font-mono">{MASTER_ADMIN_EMAIL}</span> يعمل دائمًا.
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAdd()
            }}
            placeholder="admine@example.com"
            dir="ltr"
            className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <button
          type="button"
          disabled={pending || draft.trim().length === 0}
          onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          إضافة أدمن جديد
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-lg border p-3 text-xs",
            notice.tone === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground",
          )}
        >
          {notice.text}
        </p>
      )}

      {/* قائمة الأدمنز المصرّح لهم */}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
        {emails.map((email) => {
          const isMaster = email === MASTER_ADMIN_EMAIL
          return (
            <li key={email} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {isMaster ? <ShieldCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm" dir="ltr">
                    {email}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {isMaster
                      ? "سوبر أدمن أساسي — مصرّح دائمًا"
                      : email === callerEmail
                        ? "أنت — أدمن مصرّح"
                        : "أدمن مصرّح"}
                  </span>
                </span>
              </span>

              {isMaster ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] text-primary">
                  <Lock className="h-3 w-3" />
                  غير قابل للحذف
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRemove(email)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  إلغاء الصلاحية
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

