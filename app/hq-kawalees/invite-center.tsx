"use client"

import { useState } from "react"
import { BadgeCheck, Copy, KeyRound, Plus, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  INVITE_KIND_LABELS,
  INVITE_STATUS_LABELS,
  INVITE_STATUS_TONES,
  addInviteCode,
  generateInviteCode,
  inviteCodeStats,
  releaseInviteCode,
  removeInviteCode,
  revokeInviteCode,
  useInviteCodes,
  type InviteCodeKind,
} from "@/lib/invite-codes"
import { BadgeCenter } from "@/app/hq-kawalees/badge-center"

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/** مركز أكواد الانضمام: توليد، تتبّع الحالة، والجهة المخصص لها الكود. */
export function InviteCenter() {
  const codes = useInviteCodes()
  const stats = inviteCodeStats(codes)
  const [kind, setKind] = useState<InviteCodeKind>("venue")
  const [label, setLabel] = useState("")
  const [customCode, setCustomCode] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <KeyRound className="h-5 w-5 text-primary" />
            أكواد الانضمام للمسارح والفرق
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            الأكواد المتاحة فقط هي التي تُقبل في تسجيل المسارح والفرق — والباقي يُوسم كمستعمل أو ملغى.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "إجمالي الأكواد", value: stats.total },
            { label: "متاحة", value: stats.available },
            { label: "مستعملة", value: stats.used },
            { label: "ملغاة", value: stats.revoked },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border/60 bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <p className="font-serif text-xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              نوع الكود
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as InviteCodeKind)}
                className={cn(FIELD, "mt-1")}
              >
                {(Object.keys(INVITE_KIND_LABELS) as InviteCodeKind[]).map((value) => (
                  <option key={value} value={value}>
                    {INVITE_KIND_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              الجهة المخصص لها
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="مثال: مسرح الطليعة"
                className={cn(FIELD, "mt-1")}
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
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                توليد كود جديد
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1 text-xs text-muted-foreground">
              أو أضف كودًا مخصّصًا
              <input
                value={customCode}
                onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
                placeholder="KAWALEES-2026"
                dir="ltr"
                className={cn(FIELD, "mt-1 font-mono")}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const invite = addInviteCode({ code: customCode, kind, label })
                setNotice(invite ? `تمت إضافة الكود ${invite.code}.` : "الكود غير صالح أو موجود مسبقًا.")
                setCustomCode("")
              }}
              className="rounded-full border border-border/60 px-4 py-2 text-xs transition-colors hover:bg-secondary"
            >
              إضافة الكود
            </button>
          </div>
          {notice && (
            <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              {notice}
            </p>
          )}
        </div>
      </div>

      <InviteCodesTable
        codes={codes}
        onNotice={setNotice}
      />

      <BadgeCenter />
    </div>
  )

/** جدول تتبّع أكواد الدعوة وحالتها. */
function InviteCodesTable({
  codes,
  onNotice,
}: {
  codes: ReturnType<typeof useInviteCodes>
  onNotice: (text: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-right text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">الكود</th>
            <th className="px-4 py-3 font-medium">النوع</th>
            <th className="px-4 py-3 font-medium">الجهة المخصص لها</th>
            <th className="px-4 py-3 font-medium">الحالة</th>
            <th className="px-4 py-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((item) => (
            <tr key={item.code} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                {item.code}
              </td>
              <td className="px-4 py-3 text-xs">{INVITE_KIND_LABELS[item.kind]}</td>
              <td className="px-4 py-3 text-xs">
                {item.label}
                {item.usedBy && <span className="block text-[10px] text-muted-foreground">استُعمل بواسطة: {item.usedBy}</span>}
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={INVITE_STATUS_TONES[item.status]}>{INVITE_STATUS_LABELS[item.status]}</StatusBadge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-label={`نسخ ${item.code}`}
                    onClick={() => {
                      void navigator.clipboard.writeText(item.code).catch(() => undefined)
                      onNotice(`تم نسخ الكود ${item.code}.`)
                    }}
                    className="rounded-full border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {item.status !== "available" && (
                    <button
                      type="button"
                      onClick={() => {
                        releaseInviteCode(item.code)
                        onNotice(`تم تحرير الكود ${item.code} — متاح من جديد.`)
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 px-2.5 py-1 text-[11px] text-emerald-200 transition-colors hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      تحرير
                    </button>
                  )}
                  {item.status !== "revoked" && (
                    <button
                      type="button"
                      onClick={() => {
                        revokeInviteCode(item.code)
                        onNotice(`تم إلغاء الكود ${item.code}.`)
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 px-2.5 py-1 text-[11px] text-amber-200 transition-colors hover:bg-amber-500/10"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      إلغاء
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`حذف ${item.code}`}
                    onClick={() => {
                      removeInviteCode(item.code)
                      onNotice(`تم حذف الكود ${item.code}.`)
                    }}
                    className="rounded-full border border-destructive/50 p-1.5 text-destructive-foreground transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

}
