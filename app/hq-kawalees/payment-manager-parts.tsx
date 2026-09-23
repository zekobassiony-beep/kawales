"use client"

import { useState } from "react"
import { Check, Copy, Power, Save, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PAYMENT_COLOR_PRESETS, removePaymentMethod, togglePaymentMethod, updatePaymentMethod, type PaymentMethodConfig } from "@/lib/payment-methods"

/**
 * أجزاء واجهة وسائل الدفع بنظام Dark Graphite & Gold
 * (نموذج الإضافة + كارت الوسيلة) — الوظائف مطابقة تمامًا للسابق.
 */

export type NewPaymentMethodDraft = {
  name: string
  account: string
  referenceLabel: string
  instructions: string
  colorClass: string
  emoji: string
  quickLinkUrl: string
  quickLinkLabel: string
}

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition-colors hover:border-amber-500/30"
const FIELD =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"
const GOLD_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
const SMALL_BTN = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors"

/** وهج لوني حول شعار الوسيلة حسب لوثتها اللونية. */
function logoGlow(colorClass: string): string {
  switch (colorClass) {
    case "bg-red-600":
      return "shadow-[0_0_28px_-6px_rgba(239,68,68,0.95)]"
    case "bg-sky-500":
      return "shadow-[0_0_28px_-6px_rgba(14,165,233,0.95)]"
    case "bg-emerald-600":
      return "shadow-[0_0_28px_-6px_rgba(16,185,129,0.9)]"
    case "bg-amber-500":
      return "shadow-[0_0_28px_-6px_rgba(245,158,11,0.95)]"
    case "bg-violet-600":
      return "shadow-[0_0_28px_-6px_rgba(139,92,246,0.9)]"
    default:
      return "shadow-[0_0_24px_-8px_rgba(255,255,255,0.35)]"
  }
}

/** بادج زجاجي متوهج لحالة الوسيلة. */
function StatusGlassBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur",
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.85)]"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-400",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400" : "bg-zinc-500")} />
      {active ? "مفعّلة" : "مُعطلة"}
    </span>
  )
}

/** نموذج إضافة وسيلة دفع جديدة. */
export function NewPaymentMethodForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: NewPaymentMethodDraft
  onChange: (draft: NewPaymentMethodDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const update = (patch: Partial<NewPaymentMethodDraft>) => onChange({ ...draft, ...patch })

  return (
    <div className={cn(CARD, "space-y-4 p-5")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-zinc-100">وسيلة دفع جديدة</h3>
        <button type="button" onClick={onCancel} aria-label="إغلاق" className={cn(SMALL_BTN, "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60")}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input placeholder="اسم الوسيلة *" value={draft.name} onChange={(event) => update({ name: event.target.value })} className={FIELD} />
        <input
          placeholder="رقم الحساب / المعرف *"
          value={draft.account}
          onChange={(event) => update({ account: event.target.value })}
          className={cn(FIELD, "font-mono")}
          dir="ltr"
        />
        <input placeholder="رمز تعبيري (💳)" value={draft.emoji} onChange={(event) => update({ emoji: event.target.value })} className={FIELD} />
        <input
          placeholder="ما يُطلب من العميل إدخاله (المرجع)"
          value={draft.referenceLabel}
          onChange={(event) => update({ referenceLabel: event.target.value })}
          className={FIELD}
        />
        <input
          placeholder="رابط سريع (اختياري)"
          value={draft.quickLinkUrl}
          onChange={(event) => update({ quickLinkUrl: event.target.value })}
          className={cn(FIELD, "font-mono text-xs")}
          dir="ltr"
        />
        <input
          placeholder="نص الرابط السريع"
          value={draft.quickLinkLabel}
          onChange={(event) => update({ quickLinkLabel: event.target.value })}
          className={FIELD}
        />
      </div>

      <input
        placeholder="التعليمات الظاهرة للعميل"
        value={draft.instructions}
        onChange={(event) => update({ instructions: event.target.value })}
        className={FIELD}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-400">اللون:</span>
        {PAYMENT_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.colorClass}
            type="button"
            aria-label={preset.label}
            onClick={() => update({ colorClass: preset.colorClass })}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              preset.colorClass,
              logoGlow(preset.colorClass),
              draft.colorClass === preset.colorClass ? "border-amber-400" : "border-transparent",
            )}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onSave} className={GOLD_BTN}>
          <Save className="h-4 w-4" />
          حفظ الوسيلة
        </button>
        <button type="button" onClick={onCancel} className={cn(SMALL_BTN, "border-zinc-800 px-4 py-2.5 text-zinc-300 hover:bg-zinc-800/60")}>
          إلغاء
        </button>
      </div>
    </div>
  )
}

/** كارت وسيلة دفع واحدة: تعديل مباشر + تفعيل/تعطيل + حذف. */
export function PaymentMethodRow({
  method,
  usage,
  onNotice,
}: {
  method: PaymentMethodConfig
  usage: number
  onNotice: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftAccount, setDraftAccount] = useState(method.account)
  const [draftName, setDraftName] = useState(method.name)

  return (
    <div className={cn(CARD, "p-5", !method.isActive && "border-amber-500/30")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ring-1 ring-white/10",
              method.colorClass,
              logoGlow(method.colorClass),
            )}
          >
            {method.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {method.name} <span className="font-mono text-[11px] text-zinc-500">({method.id})</span>
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-amber-400/90" dir="ltr">
              {method.account}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{usage} تذكرة استخدمت هذه الوسيلة</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusGlassBadge active={method.isActive} />
          <button
            type="button"
            onClick={() => {
              togglePaymentMethod(method.id)
              onNotice(
                method.isActive
                  ? `تم تعطيل «${method.name}» — اختفت من صفحة الحجز.`
                  : `تم تفعيل «${method.name}» — ظهرت في صفحة الحجز.`,
              )
            }}
            className={cn(
              SMALL_BTN,
              method.isActive
                ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
            )}
          >
            <Power className="h-3.5 w-3.5" />
            {method.isActive ? "تعطيل مؤقت" : "تفعيل"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={cn(SMALL_BTN, "border-zinc-800 text-zinc-300 hover:bg-zinc-800/60")}
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {open ? "إغلاق التعديل" : "تعديل"}
          </button>
          <button
            type="button"
            aria-label={`حذف ${method.name}`}
            onClick={() => {
              removePaymentMethod(method.id)
              onNotice(`تم حذف «${method.name}» نهائيًا.`)
            }}
            className={cn(SMALL_BTN, "border-red-500/40 px-2 text-red-300 hover:bg-red-500/10")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!method.isActive && (
        <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          الوسيلة معطّلة مؤقتًا — لا تظهر للعملاء في خطوة الدفع.
        </p>
      )}

      {open && (
        <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={FIELD} placeholder="اسم الوسيلة" />
          <input
            value={draftAccount}
            onChange={(event) => setDraftAccount(event.target.value)}
            className={cn(FIELD, "font-mono")}
            dir="ltr"
            placeholder="رقم الحساب / المعرف"
          />
          <input
            defaultValue={method.referenceLabel}
            onBlur={(event) => updatePaymentMethod(method.id, { referenceLabel: event.target.value })}
            className={FIELD}
            placeholder="حقل المرجع المطلوب من العميل"
          />
          <input
            defaultValue={method.instructions}
            onBlur={(event) => updatePaymentMethod(method.id, { instructions: event.target.value })}
            className={FIELD}
            placeholder="التعليمات"
          />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <span className="text-xs text-zinc-400">اللون:</span>
            {PAYMENT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.colorClass}
                type="button"
                aria-label={preset.label}
                onClick={() => updatePaymentMethod(method.id, { colorClass: preset.colorClass })}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  preset.colorClass,
                  logoGlow(preset.colorClass),
                  method.colorClass === preset.colorClass ? "border-amber-400" : "border-transparent",
                )}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                updatePaymentMethod(method.id, { name: draftName, account: draftAccount })
                onNotice(`تم حفظ تعديلات «${draftName}» — ظاهرة الآن في صفحة الحجز.`)
              }}
              className={cn(GOLD_BTN, "ms-auto px-4 py-2 text-xs")}
            >
              <Save className="h-3.5 w-3.5" />
              حفظ التعديلات
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(method.account).catch(() => undefined)
                onNotice(`تم نسخ «${method.account}».`)
              }}
              className={cn(SMALL_BTN, "border-zinc-800 px-3 py-2 text-zinc-300 hover:bg-zinc-800/60")}
            >
              <Copy className="h-3.5 w-3.5" />
              نسخ الرقم
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
