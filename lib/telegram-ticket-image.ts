import { qrPngBuffer } from "@/lib/qr-png"

/**
 * إرسال صورة رمز QR النهائية إلى تليجرام (نفس الرمز المعروض على الموقع)
 * عند قبول الحجز. ملف سيرفر فقط (يعتمد على مُشفّر PNG في `lib/qr-png`).
 */
export async function sendTicketQrImage(input: {
  qrPayload: string
  caption: string
  /** معرّف المحادثة — الافتراضي محادثة الإدارة. */
  chatId?: string | number
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = input.chatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID غير مهيأة — تخطّي إرسال رمز QR.")
    return
  }

  try {
    const png = qrPngBuffer(input.qrPayload, 12)
    const form = new FormData()
    form.append("chat_id", String(chatId))
    form.append("caption", input.caption)
    form.append("parse_mode", "HTML")
    form.append("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), `kawalees-qr-${input.qrPayload.slice(-6)}.png`)
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form })
  } catch (error) {
    console.error(`[telegram] sendTicketQrImage failed: ${error instanceof Error ? error.message : error}`)
  }
}
