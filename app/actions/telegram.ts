"use server"

import { sendReceiptToTelegram, type ReceiptVerificationInput } from "@/lib/telegram"
import { registerTicketRecord } from "@/lib/ticket-registry"

/**
 * إجراء سيرفر يستدعيه العميل بعد إنشاء التذكرة: يسجّل التذكرة كاملة كـ `pending`
 * (مع حمولة رمز QR) في سجل الخادم، ثم يرسل الإيصال للإدارة على تليجرام
 * مع أزرار قبول/رفض.
 */
export async function sendReceiptVerification(input: ReceiptVerificationInput): Promise<{ ok: boolean }> {
  try {
    registerTicketRecord({
      ticketId: input.ticketId,
      qrPayload: input.qrPayload,
      showTitle: input.showTitle,
      seatsLabel: input.seatsLabel,
      customerName: "",
      senderPhone: input.senderPhone,
      totalCents: input.totalCents,
      status: "pending",
    })
    await sendReceiptToTelegram(input)
    return { ok: true }
  } catch (error) {
    console.error(`[telegram] sendReceiptVerification failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}
