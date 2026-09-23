"use server"

import { sendReceiptToTelegram, type ReceiptVerificationInput } from "@/lib/telegram"

/**
 * إجراء سيرفر يستدعيه العميل بعد إنشاء التذكرة: يرسل الإيصال للإدارة على
 * تليجرام مع أزرار قبول/رفض. (حفظ التذكرة الكاملة في Supabase يتم عبر
 * `persistTicket` في `app/actions/tickets` من نفس مسار الحجز).
 */
export async function sendReceiptVerification(input: ReceiptVerificationInput): Promise<{ ok: boolean }> {
  try {
    await sendReceiptToTelegram(input)
    return { ok: true }
  } catch (error) {
    console.error(`[telegram] sendReceiptVerification failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}
