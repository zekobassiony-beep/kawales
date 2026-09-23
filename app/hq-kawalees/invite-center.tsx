"use client"

import { useState } from "react"
import { KeyRound, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  INVITE_KIND_LABELS,
  addInviteCode,
  generateInviteCode,
  inviteCodeStats,
  useInviteCodes,
  type InviteCodeKind,
} from "@/lib/invite-codes"
import { BadgeCenter } from "@/app/hq-kawalees/badge-center"
import { InviteCodesTable } from "@/app/hq-kawalees/invite-center-parts"

/**
 * أكواد الانضمام والتوثيق — Dark Graphite & Gold:
 * شبكة KPI بأرقام ذهبية + كارت توليد احترافي + جدول تتبّع + مركز التوثيق.
 * المنطق كما هو تمامًا (`generateInviteCode` / `addInviteCode` / release / revoke / remove).
 */

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-colors"
const FIELD =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"
const GOLD_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"

export function InviteCenter() {
  const codes = useInviteCodes()
  const stats = inviteCodeStats(codes)
  const [kind, setKind] = useState<InviteCodeKind>("venue")
  const [label, setLabel] = useState("")
  const [customCode, setCustomCode] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <KeyRound className="h-4 w-4" />
          </span>
          أكواد الانضمام والتوثيق
        </h2>
        <p className="mt-1.5 text-xs text-zinc-400">
          الأكواد المتاحة فقط هي التي تُقبل في تسجيل المسارح والفرق — والباقي يُوسم كمستعمل أو ملغى.
        </p>
      </div>

      {/* شبكة KPI (4 أسرّة بأرقام ذهبية) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "إجمالي الأكواد", value: stats.total, hint: "كل الأكواد المسجّلة" },
          { label: "متاحة", value: stats.available, hint: "جاهزة للتسجيل الآن" },
          { label: "مستعملة", value: stats.used, hint: "استُخدمت في تسجيل" },
          { label: "ملغاة", value: stats.revoked, hint: "أُلغيت يدويًا" },
        ].map((card) => (
          <div key={card.label} className={cn(CARD, "p-5 hover:border-amber-500/30")}>
            <p className="text-xs font-medium text-zinc-400">{card.label}</p>
            <p className="mt-1 font-serif text-4xl font-bold text-amber-400">{card.value}</p>
            <p className="mt-1.5 text-[11px] text-zinc-500">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* كارت إنشاء وتوليد الأكواد */}
      <div className={cn(CARD, "space-y-4 p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-zinc-100">
            <Sparkles className="h-4 w-4 text-amber-400" />
            إنشاء كود انضمام جديد
          </h3>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
            توليد فوري
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-400">
            نوع الكود
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as InviteCodeKind)}
              className={cn(FIELD, "mt-1.5")}
            >
              {(Object.keys(INVITE_KIND_LABELS) as InviteCodeKind[]).map((value) => (
                <option key={value} value={value}>
                  {INVITE_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            الجهة المخصص لها
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="مثال: مسرح الطليعة"
              className={cn(FIELD, "mt-1.5")}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                const invite = generateInviteCode(kind, label)
                setNotice(`تم توليد الكود ${invite.code} — متاح الآن.`)
                setLabel("")
              }}
              className={cn(GOLD_BTN, "w-full")}
            >
              <Plus className="h-4 w-4" />
              توليد كود جديد
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
          <label className="min-w-48 flex-1 text-xs text-zinc-400">
            أو أضف كودًا مخصّصًا
            <input
              value={customCode}
              onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
              placeholder="KAWALEES-2026"
              dir="ltr"
              className={cn(FIELD, "mt-1.5 font-mono")}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const invite = addInviteCode({ code: customCode, kind, label })
              setNotice(invite ? `تمت إضافة الكود ${invite.code}.` : "الكود غير صالح أو موجود مسبقًا.")
              setCustomCode("")
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
          >
            <Plus className="h-4 w-4" />
            إضافة الكود
          </button>
        </div>

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 backdrop-blur"
          >
            {notice}
          </p>
        )}
      </div>

      <InviteCodesTable codes={codes} onNotice={setNotice} />

      <BadgeCenter />
    </div>
  )
}

