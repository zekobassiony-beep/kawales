"use client"

import { useState } from "react"
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react"
import { setMyPassword } from "@/app/actions/profile"

/**
 * «أضف كلمة مرور لحسابك» — للحسابات التي أُنشئت بحساب Google (بلا كلمة مرور).
 *
 * بعد الدخول بجوجل يصير بإمكان المستخدم ضبط كلمة مرور لنفس الحساب، فيستطيع
 * لاحقًا الدخول بالطريقة التي يريدها من غير تعارض بين الطريقتين.
 * التحقق يتم على السيرفر من الجلسة الحقيقية (`setMyPassword`)، فلا يمكن
 * استخدامها لتغيير كلمة مرور حساب آخر.
 */
export function AddPasswordPanel() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setError("")
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.")
      return
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.")
      return
    }
    setPending(true)
    try {
      const result = await setMyPassword(password)
      if (!result.ok) {
        setError(result.error ?? "تعذّر ضبط كلمة المرور.")
        return
      }
      setDone(true)
      setPassword("")
      setConfirm("")
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
      >
        <KeyRound className="h-3 w-3" />
        دخلت بحساب Google وتريد كلمة مرور أيضًا؟ اضبطها الآن
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        أنشئ كلمة مرور لحسابك الحالي (المسجَّل دخوله الآن) فتصبح قادرًا على الدخول بالبريد وكلمة المرور
        أو بحساب Google — كلاهما لنفس الحساب.
      </p>

      {done ? (
        <p className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          تمّ ضبط كلمة المرور — جرّب «تسجيل الدخول» بها في المرة القادمة.
        </p>
      ) : (
        <>
          <div className="mt-2 grid gap-2">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="كلمة المرور الجديدة"
              dir="ltr"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="تأكيد كلمة المرور"
              dir="ltr"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive-foreground">
              {error}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              اضبط كلمة المرور
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
            >
              إلغاء
            </button>
          </div>
        </>
      )}
    </div>
  )
}
