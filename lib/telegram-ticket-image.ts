import { qrPngBuffer } from "@/lib/qr-png"
import { callTelegramBot, type TelegramSendResult } from "@/lib/telegram"

/**
 * «مولّد التذكرة»: يبني صورة رمز QR النهائية على السيرفر (نفس الرمز المعروض
 * على الموقع) ويرسلها إلى تليجرام. التليجرام هو من يولّد ويسلّم التذكرة،
 * والموقع يعرض نفس الصورة كـ Viewer. ملف سيرفر فقط (يعتمد على `lib/qr-png`).
 */

/** يبني صورة PNG لرمز QR التذكرة (نفس الصورة التي يسلّمها البوت). */
export function buildTicketQrPng(qrPayload: string, scale = 12): Buffer {
  return qrPngBuffer(qrPayload, scale)
}

/** يرسل صورة رمز QR النهائية إلى تليجرام، مع لوج صريح ونتيجة منظّمة. */
export async function sendTicketQrImage(input: {
  qrPayload: string
  caption: string
  /** معرّف المحادثة — الافتراضي محادثة الإدارة. */
  chatId?: string | number
}): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = input.chatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.error("[telegram] تعذّر إرسال صورة التذكرة: TELEGRAM_BOT_TOKEN أو chat_id غير مهيأ.")
    return { ok: false, error: "TELEGRAM_NOT_CONFIGURED", code: "not_configured" }
  }

  console.log(`[telegram] إرسال صورة التذكرة إلى chat_id=${chatId}…`)
  const png = buildTicketQrPng(input.qrPayload, 12)
  const form = new FormData()
  form.append("chat_id", String(chatId))
  form.append("caption", input.caption)
  form.append("parse_mode", "HTML")
  form.append(
    "photo",
    new Blob([new Uint8Array(png)], { type: "image/png" }),
    `kawalees-qr-${input.qrPayload.slice(-6)}.png`,
  )
  return callTelegramBot(token, "sendPhoto", form)
}
