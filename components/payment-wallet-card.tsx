"use client"

import { useState } from "react"
import { Check, Copy, Wallet } from "lucide-react"
import { PAYMENT_WALLET_NUMBER } from "@/lib/payment"

/**
 * كارت الدفع: رقم محفظة فودافون كاش / إنستاباي مع زر نسخ وتعليمات التحويل.
 * يُعرض فوق نموذج الحجز ليحوّل العميل الإجمالي ثم يرفق الإيصال.
 */
export function PaymentWalletCard({ totalLabel }: { totalLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(PAYMENT_WALLET_NUMBER)
    } catch {
      const input = document.createElement("input")
      input.value = PAYMENT_WALLET_NUMBER
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-accent/10">
      <div className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          الدفع عبر فودافون كاش أو إنستاباي
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          قم بتحويل المبلغ الإجمالي ({totalLabel}) عبر فودافون كاش أو إنستاباي إلى الرقم
          أدناه، ثم أرفق صورة إيصال التحويل لإتمام الحجز.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-widest text-foreground" dir="ltr">
            {PAYMENT_WALLET_NUMBER}
          </span>
          <button
            type="button"
            onClick={copyNumber}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                تم النسخ ✓
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                نسخ الرقم
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}