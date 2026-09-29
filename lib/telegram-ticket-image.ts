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
  // دقة 16 بكسل للوحدة ⇒ رمز كبير وحواف نظيفة، ومعه منطقة هدوء قياسية.
  const png = buildTicketQrPng(input.qrPayload, 16)
  const fileName = `kawalees-ticket-${input.qrPayload.slice(-6)}.png`
  const blob = new Blob([new Uint8Array(png)], { type: "image/png" })

  // ⚠️ الإرسال **كمستند** لا كصورة: تليجرام يعيد ضغط الصور فيفسد وحدات الرمز
  // ويصبح غير قابل للمسح. المستند يُسلَّم كما هو بجودته الأصلية.
  const asDocument = new FormData()
  asDocument.append("chat_id", String(chatId))
  asDocument.append("caption", input.caption)
  asDocument.append("parse_mode", "HTML")
  asDocument.append("document", blob, fileName)

  const documentResult = await callTelegramBot(token, "sendDocument", asDocument)
  if (documentResult.ok) return documentResult

  console.warn(
    `[telegram] فشل إرسال التذكرة كمستند (${documentResult.error ?? "?"}) — إعادة المحاولة كصورة.`,
  )

  const asPhoto = new FormData()
  asPhoto.append("chat_id", String(chatId))
  asPhoto.append("caption", input.caption)
  asPhoto.append("parse_mode", "HTML")
  asPhoto.append("photo", blob, fileName)

  const photoResult = await callTelegramBot(token, "sendPhoto", asPhoto)
  return photoResult.ok ? { ...photoResult, warning: "أُرسلت كصورة (قد يعيد تليجرام ضغطها)" } : photoResult
}

