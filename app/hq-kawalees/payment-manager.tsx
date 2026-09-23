"use client"

import { useState } from "react"
import { CreditCard, Plus, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PAYMENT_COLOR_PRESETS,
  addPaymentMethod,
  resetPaymentMethods,
  usePaymentMethods,
} from "@/lib/payment-methods"
import { useTickets } from "@/lib/tickets"
import { NewPaymentMethodForm, PaymentMethodRow, type NewPaymentMethodDraft } from "@/app/hq-kawalees/payment-manager-parts"

/**
 * مركز إدارة وسائل الدفع المباشر (Dark Graphite & Gold):
 * تعديل/إضافة/تفعيل — بتحديث لحظي لصفحة الحجز. المنطق كما هو، والواجهة بالنظام الجديد.
 */

const HEADER_BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"

export function PaymentManager() {
  const methods = usePaymentMethods()
  const tickets = useTickets()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<NewPaymentMethodDraft>({
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

  const resetDraft = () =>
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

  return (
    <div className="space-y-5">
      {/* الترويسة + الأزرار الرئيسية */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <CreditCard className="h-4.5 w-4.5" />
            </span>
            وسائل الدفع المباشر
          </h2>
          <p className="mt-1.5 text-xs text-zinc-400">
            أي تعديل هنا ينعكس <span className="font-semibold text-amber-400">لحظيًا</span> في خطوة الدفع بصفحة الحجز.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            إضافة وسيلة دفع جديدة
          </button>
          <button
            type="button"
            onClick={() => {
              resetPaymentMethods()
              setNotice("تم استرجاع وسائل الدفع الافتراضية.")
            }}
            className={cn(HEADER_BTN, "px-4 py-2.5")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            استرجاع الافتراضي
          </button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 backdrop-blur"
        >
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
            resetDraft()
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {methods.map((method) => (
          <PaymentMethodRow key={method.id} method={method} usage={usageOf(method.id)} onNotice={setNotice} />
        ))}
      </div>
    </div>
  )
}
