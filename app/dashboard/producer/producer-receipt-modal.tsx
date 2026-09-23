"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { Ticket } from "@/lib/tickets"

/** نافذة معاينة صورة إيصال التحويل. */
export function ReceiptPreviewModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  if (!ticket) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">إيصال {ticket.id}</p>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-zinc-950 p-3">
          {ticket.receiptImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.receiptImage}
              alt={`إيصال التذكرة ${ticket.id}`}
              className="mx-auto max-h-[70vh] rounded-xl object-contain"
            />
          ) : (
            <p className="py-10 text-center text-xs text-zinc-500">لا توجد صورة إيصال مرفقة بهذه التذكرة.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** حالة داخلية مبسطة لعرض الإشعارات في مركز المراجعة. */
export function useReceiptNotice() {
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  return { notice, setNotice, clear: () => setNotice(null) }
}
