"use server"

import { sendReceiptToTelegram, type ReceiptVerificationInput } from "@/lib/telegram"
import { registerTicketStatus } from "@/lib/ticket-registry"

/**
 * إجراء سيرفر يستدعيه العميل بعد إنشاء التذكرة: يسجّل التذكرة كـ `pending`
 * في سجل الخادم ثم يرسل الإيصال للإدارة على تليجرام مع أزرار قبول/رفض.
 */
export async function sendReceiptVerification(input: ReceiptVerificationInput): Promise<{ ok: boolean }> {
  try {
    registerTicketStatus(input.ticketId, "pending")
    await sendReceiptToTelegram(input)
    return { ok: true }
  } catch (error) {
    console.error(`[telegram] sendReceiptVerification failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}
