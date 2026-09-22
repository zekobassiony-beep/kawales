"use client"

import Link from "next/link"
import { BadgeCheck, Pencil, Send } from "lucide-react"
import { LOGIN_PATH, ONBOARDING_PATH, ROLE_LABELS, TELEGRAM_BOT_URL } from "@/lib/roles"
import { updateProfile, useSession } from "@/lib/session"

/** ترويسة لوحة العميل: تقرأ الجلسة المحلية وتعرض الصورة والاسم وحالة ربط تليجرام. */
export function CustomerStrip() {
  const user = useSession()

  if (!user) {
    return (
      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-5">
        <p className="font-serif text-xl font-semibold">مرحبًا بك في كواليس</p>
        <p className="mt-2 text-sm text-muted-foreground">
          سجّل الدخول كعميل لتظهر حجوزاتك وتذاكرك هنا، ويمكنك ربط الحساب بتليجرام لاستلام التذاكر.
        </p>
        <Link
          href={LOGIN_PATH}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          بوابة الدخول واختيار الشخصية
        </Link>
      </div>
    )
  }

  const name = user.profile.fullName || user.name
  const avatarUrl = user.profile.avatarUrl
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")

  const linkTelegram = () => {
    window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer")
    updateProfile({ telegramLinked: true })
  }

  return (
    <header className="mt-4 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-secondary text-sm font-semibold text-secondary-foreground">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة من الجلسة (رابط أو data URL)
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initials || "ك"
          )}
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">{ROLE_LABELS[user.role]}</p>
          <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email || "جلسة تجريبية محفوظة محليًا"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={ONBOARDING_PATH}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <Pencil className="h-3.5 w-3.5" />
          تعديل بياناتي
        </Link>

        {user.profile.telegramLinked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            تليجرام مرتبط
          </span>
        ) : (
          <button
            type="button"
            onClick={linkTelegram}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#229ED9] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Send className="h-3.5 w-3.5" />
            ربط الحساب بالتليجرام
          </button>
        )}
      </div>
    </header>
  )
}
