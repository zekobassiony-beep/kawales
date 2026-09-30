"use client"

import { useState, useTransition } from "react"
import { Check, Eye, EyeOff, KeyRound, Loader2, Lock, Save, Send, ShieldCheck, User } from "lucide-react"
import { setMyPassword, saveMyProfile } from "@/app/actions/profile"
import { updateProfile, useSession } from "@/lib/session"
import { TELEGRAM_BOT_URL } from "@/lib/roles"

export function CustomerAccountSettings() {
  const session = useSession()
  const [fullName, setFullName] = useState(session?.profile.fullName || session?.name || "")
  const [namePending, startNameTransition] = useTransition()
  const [nameNotice, setNameNotice] = useState<{ ok: boolean; message: string } | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordPending, startPasswordTransition] = useTransition()
  const [passwordNotice, setPasswordNotice] = useState<{ ok: boolean; message: string } | null>(null)

  if (!session) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
        سجّل الدخول لتتمكن من تعديل اسمك أو تغيير كلمة المرور.
      </div>
    )
  }

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault()
    setNameNotice(null)
    const trimmed = fullName.trim()
    if (trimmed.length < 2) {
      setNameNotice({ ok: false, message: "يرجى إدخال اسم صحيح مكون من حرفين على الأقل." })
      return
    }

    startNameTransition(async () => {
      // 1. حفظ في قاعدة البيانات على السيرفر
      const res = await saveMyProfile({
        profile: { ...session.profile, fullName: trimmed },
      })
      if (!res.ok) {
        setNameNotice({ ok: false, message: res.error || "تعذّر حفظ الاسم، يرجى المحاولة لاحقًا." })
        return
      }

      // 2. تحديث الجلسة المحلية ليتغير الاسم فورًا في كامل الواجهة
      updateProfile({ fullName: trimmed })
      setNameNotice({ ok: true, message: "تم تحديث اسمك بنجاح في المنصة." })
    })
  }

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordNotice(null)

    if (password.length < 6) {
      setPasswordNotice({ ok: false, message: "كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام." })
      return
    }
    if (password !== confirmPassword) {
      setPasswordNotice({ ok: false, message: "كلمة المرور وتأكيدها غير متطابقين." })
      return
    }

    startPasswordTransition(async () => {
      const res = await setMyPassword(password)
      if (res.ok) {
        setPasswordNotice({ ok: true, message: "تم تغيير كلمة المرور بنجاح. يمكنك استخدامها الآن في الدخول." })
        setPassword("")
        setConfirmPassword("")
      } else {
        setPasswordNotice({ ok: false, message: res.error || "تعذّر تغيير كلمة المرور." })
      }
    })
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* بطاقة تغيير الاسم */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border/60 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold">تعديل الاسم الشخصي</h3>
            <p className="text-xs text-muted-foreground">يظهر هذا الاسم على تذاكرك وتقييماتك الرسمية</p>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="mt-5 space-y-4">
          <div>
            <label htmlFor="customer-settings-name" className="block text-xs font-medium text-muted-foreground">
              الاسم الكامل
            </label>
            <input
              id="customer-settings-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أحمد محمود"
              className="mt-1.5 w-full rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground">البريد الإلكتروني المسجّل</label>
            <input
              type="text"
              disabled
              value={session.email || "غير محدد"}
              dir="ltr"
              className="mt-1.5 w-full rounded-xl border border-border/40 bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">البريد مربوط بحسابك بشكل دائم ولا يمكن تغييره يدوياً.</p>
          </div>

          {nameNotice && (
            <p
              className={`rounded-xl border p-3 text-xs ${
                nameNotice.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
              }`}
            >
              {nameNotice.message}
            </p>
          )}

          <button
            type="submit"
            disabled={namePending || fullName.trim() === (session.profile.fullName || session.name)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {namePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الاسم
          </button>
        </form>
      </div>

      {/* بطاقة تغيير كلمة المرور */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border/60 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold">أمان الحساب وكلمة المرور</h3>
            <p className="text-xs text-muted-foreground">تحديث كلمة المرور لحسابك المسجّل</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
          <div>
            <label htmlFor="customer-settings-password" className="block text-xs font-medium text-muted-foreground">
              كلمة المرور الجديدة
            </label>
            <div className="relative mt-1.5">
              <input
                id="customer-settings-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف أو أرقام على الأقل"
                className="w-full rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="customer-settings-confirm" className="block text-xs font-medium text-muted-foreground">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              id="customer-settings-confirm"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد إدخال كلمة المرور"
              className="mt-1.5 w-full rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {passwordNotice && (
            <p
              className={`rounded-xl border p-3 text-xs ${
                passwordNotice.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
              }`}
            >
              {passwordNotice.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              disabled={passwordPending || password.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/90 px-5 py-2.5 text-xs font-semibold text-zinc-950 shadow-sm transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passwordPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              تحديث كلمة المرور
            </button>

            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              تشفير مشدد
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
