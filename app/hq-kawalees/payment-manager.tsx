"use client"

import { useState } from "react"
import { Copy, CreditCard, Plus, Power, RotateCcw, Save, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/app/dashboard/ui"
import {
  PAYMENT_COLOR_PRESETS,
  addPaymentMethod,
  removePaymentMethod,
  resetPaymentMethods,
  togglePaymentMethod,
  updatePaymentMethod,
  usePaymentMethods,
  type PaymentMethodConfig,
} from "@/lib/payment-methods"
import { useTickets } from "@/lib/tickets"

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"

/** مركز إدارة وسائل الدفع المباشر: تعديل/إضافة/تفعيل — بتحديث لحظي لصفحة الحجز. */
export function PaymentManager() {
  const methods = usePaymentMethods()
  const tickets = useTickets()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    name: "",
    account: "",
    referenceLabel: "",
    instructions: "",
    colorClass: PAYMENT_COLOR_PRESETS[0].colorClass,
    emoji: "💳",
    quickLinkUrl: "",
    quickLinkLabel: "",
  })

  const usageOf = (id: string) => tickets.filter((ticket) => ticket.paymentMethod === id).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <CreditCard className="h-5 w-5 text-primary" />
            وسائل الدفع المباشر
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            أي تعديل هنا ينعكس <span className="font-semibold text-foreground">لحظيًا</span> في خطوة الدفع بصفحة الحجز.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة وسيلة دفع جديدة
          </button>
          <button
            type="button"
            onClick={() => {
              resetPaymentMethods()
              setNotice("تم استرجاع وسائل الدفع الافتراضية.")
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            استرجاع الافتراضي
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {notice}
        </p>
      )}

      {adding && (
        <NewPaymentMethodForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setAdding(false)}
          onSave={() => {
            if (draft.name.trim().length < 2 || draft.account.trim().length < 3) {
              setNotice("أدخل اسم الوسيلة ورقم الحساب/المعرف.")
              return
            }
            const created = addPaymentMethod(draft)
            setNotice(`تمت إضافة «${created.name}» — مفعّلة الآن في صفحة الحجز.`)
            setAdding(false)
            setDraft({
              name: "",
              account: "",
              referenceLabel: "",
              instructions: "",
              colorClass: PAYMENT_COLOR_PRESETS[0].colorClass,
              emoji: "💳",
              quickLinkUrl: "",
              quickLinkLabel: "",
            })
          }}
        />
      )}

      <div className="space-y-3">
        {methods.map((method) => (
          <PaymentMethodRow key={method.id} method={method} usage={usageOf(method.id)} onNotice={setNotice} />
        ))}
      </div>
    </div>
  )

/** نموذج إضافة وسيلة دفع جديدة. */
function NewPaymentMethodForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: {
    name: string
    account: string
    referenceLabel: string
    instructions: string
    colorClass: string
    emoji: string
    quickLinkUrl: string
    quickLinkLabel: string
  }
  onChange: (draft: NewPaymentMethodDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const update = (patch: Partial<NewPaymentMethodDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <span className="text-xs text-muted-foreground">اللون:</span>
        {PAYMENT_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.colorClass}
            type="button"
            aria-label={preset.label}
            onClick={() => update({ colorClass: preset.colorClass })}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              preset.colorClass,
              draft.colorClass === preset.colorClass ? "border-foreground" : "border-transparent",
            )}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          حفظ الوسيلة
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-border/60 px-4 py-2 text-xs">
          إلغاء
        </button>
      </div>
    </div>
  )
}

type NewPaymentMethodDraft = {
  name: string
  account: string
  referenceLabel: string
  instructions: string
  colorClass: string
  emoji: string
  quickLinkUrl: string
  quickLinkLabel: string
}


/** صف وسيلة دفع واحدة: تعديل مباشر + تفعيل/تعطيل + حذف. */
function PaymentMethodRow({
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
    <div className={cn("rounded-xl border bg-card p-4", method.isActive ? "border-border/60" : "border-amber-500/40 opacity-80")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-base", method.colorClass)}>{method.emoji}</span>
          <div>
            <p className="text-sm font-semibold">
              {method.name} <span className="font-mono text-[11px] text-muted-foreground">({method.id})</span>
            </p>
            <p className="font-mono text-xs text-muted-foreground" dir="ltr">
              {method.account}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={method.isActive ? "green" : "amber"}>{method.isActive ? "مفعّلة" : "معطّلة مؤقتًا"}</StatusBadge>
          <span className="text-[11px] text-muted-foreground">{usage} تذكرة</span>
          <button
            type="button"
            onClick={() => {
              togglePaymentMethod(method.id)
              onNotice(method.isActive ? `تم تعطيل «${method.name}» — اختفت من صفحة الحجز.` : `تم تفعيل «${method.name}» — ظهرت في صفحة الحجز.`)
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              method.isActive ? "border-amber-500/50 text-amber-200 hover:bg-amber-500/10" : "border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/10",
            )}
          >
            <Power className="h-3.5 w-3.5" />
            {method.isActive ? "تعطيل مؤقت" : "تفعيل"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="rounded-full border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
          >
            {open ? "إغلاق التعديل" : "تعديل"}
          </button>
          <button
            type="button"
            aria-label={`حذف ${method.name}`}
            onClick={() => {
              removePaymentMethod(method.id)
              onNotice(`تم حذف «${method.name}» نهائيًا.`)
            }}
            className="rounded-full border border-destructive/50 p-1.5 text-destructive-foreground transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={FIELD} placeholder="اسم الوسيلة" />
          <input value={draftAccount} onChange={(event) => setDraftAccount(event.target.value)} className={cn(FIELD, "font-mono")} dir="ltr" placeholder="رقم الحساب / المعرف" />
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
            <span className="text-xs text-muted-foreground">اللون:</span>
            {PAYMENT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.colorClass}
                type="button"
                aria-label={preset.label}
                onClick={() => updatePaymentMethod(method.id, { colorClass: preset.colorClass })}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  preset.colorClass,
                  method.colorClass === preset.colorClass ? "border-foreground" : "border-transparent",
                )}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                updatePaymentMethod(method.id, { name: draftName, account: draftAccount })
                onNotice(`تم حفظ تعديلات «${draftName}» — ظاهرة الآن في صفحة الحجز.`)
              }}
              className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
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

}
