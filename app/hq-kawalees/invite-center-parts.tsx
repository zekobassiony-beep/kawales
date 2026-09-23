"use client"

import { BadgeCheck, Copy, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  INVITE_KIND_LABELS,
  INVITE_STATUS_LABELS,
  INVITE_STATUS_TONES,
  releaseInviteCode,
  removeInviteCode,
  revokeInviteCode,
  useInviteCodes,
} from "@/lib/invite-codes"

/**
 * جدول تتبّع أكواد الدعوة وحالتها — Dark Graphite & Gold
 * (نفس منطق الأزرار: نسخ / تحرير / إلغاء / حذف).
 */

const SMALL_BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors"

export function InviteCodesTable({
  codes,
  onNotice,
}: {
  codes: ReturnType<typeof useInviteCodes>
  onNotice: (text: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-right text-xs text-zinc-400">
            <th className="px-4 py-3 font-medium">الكود</th>
            <th className="px-4 py-3 font-medium">النوع</th>
            <th className="px-4 py-3 font-medium">الجهة المخصص لها</th>
            <th className="px-4 py-3 font-medium">الحالة</th>
            <th className="px-4 py-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((item) => (
            <tr key={item.code} className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/30">
              <td className="px-4 py-3 font-mono text-xs text-amber-400" dir="ltr">
                {item.code}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-300">{INVITE_KIND_LABELS[item.kind]}</td>
              <td className="px-4 py-3 text-xs text-zinc-300">
                {item.label}
                {item.usedBy && <span className="block text-[10px] text-zinc-500">استُعمل بواسطة: {item.usedBy}</span>}
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
                    className={cn(SMALL_BTN, "border-zinc-800 px-2 text-zinc-400 hover:bg-zinc-800/60")}
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
                      className={cn(SMALL_BTN, "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10")}
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
                      className={cn(SMALL_BTN, "border-amber-500/40 text-amber-300 hover:bg-amber-500/10")}
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
                    className={cn(SMALL_BTN, "border-red-500/40 px-2 text-red-300 hover:bg-red-500/10")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {codes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">
                لا توجد أكواد بعد — ولّد كودًا جديدًا من الأعلى.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
