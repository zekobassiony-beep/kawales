import { NextRequest, NextResponse } from "next/server"
import { getTicketRecord, setTicketStatusOnServer } from "@/lib/ticket-registry"
import { sendTicketQrImage } from "@/lib/telegram-ticket-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TelegramCallbackQuery = {
  id: string
  data?: string
  message?: { chat?: { id: number }; message_id?: number; caption?: string }
}

async function callTelegram(token: string, method: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

/** يحدّث نص الرسالة ويزيل الأزرار التفاعلية. */
async function updateReceiptMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    caption: text,
    parse_mode: "HTML",
    // إزالة الأزرار بعد التنفيذ لمنع التكرار.
    reply_markup: { inline_keyboard: [] },
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined)

  // رسالة نصية بلا صورة: نستخدم editMessageText.
  if (!response || !response.ok) {
    await callTelegram(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] },
    })
  }
}

/**
 * ويب هوك تليجرام: يستقبل التفاعل مع أزرار الإدارة (`approve_{ticketId}` /
 * `reject_{ticketId}`)، يرد فورًا على البوت (لمنع تعليق الزر)، يُحدّث حالة
 * التذكرة، يحدّث نص الرسالة ويزيل الأزرار، ثم يرسل رمز QR عند القبول.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const body = (await req.json().catch(() => null)) as { callback_query?: TelegramCallbackQuery } | null
  const callback = body?.callback_query
  if (!callback) return NextResponse.json({ ok: true })

  const match = /^(approve|reject)_(.+)$/.exec(callback.data ?? "")

  // (1) الرد الفوري على البوت — قبل أي معالجة أخرى لمنع مؤشر التحميل المستمر.
  if (token) {
    await callTelegram(token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: match ? (match[1] === "approve" ? "تم القبول ✅" : "تم الرفض ❌") : "تم التنفيذ",
    })
  }

  if (match) {
    const approved = match[1] === "approve"
    const ticketId = match[2].toUpperCase()
    const decision = approved ? "approved" : "rejected"
    const confirmationText = approved ? "تم قبول الحجز وتأكيد التذكرة ✅" : "تم رفض الحجز ❌"

    // (2) تحديث حالة التذكرة في سجل الخادم.
    setTicketStatusOnServer(ticketId, decision)

    if (token) {
      // (3) تحديث نص الرسالة وإزالة الأزرار.
      const chatId = callback.message?.chat?.id
      const messageId = callback.message?.message_id
      if (chatId && messageId) {
        await updateReceiptMessage(token, chatId, messageId, confirmationText)
      }

      // (4) عند القبول: إرسال نفس رمز QR المعروض على الموقع للعميل/الإدارة.
      if (approved) {
        const record = getTicketRecord(ticketId)
        if (record) {
          await sendTicketQrImage({
            qrPayload: record.qrPayload,
            chatId,
            caption: [
              "🎟️ <b>تم قبول الحجز وتأكيد التذكرة ✅</b>",
              `🎫 الكود: <code>${record.ticketId}</code>`,
              record.showTitle ? `📌 العرض: ${record.showTitle}` : "",
              record.seatsLabel ? `💺 المقاعد: ${record.seatsLabel}` : "",
              "",
              "هذا هو رمز الدخول — اعرضه عند بوابة المسرح.",
            ]
              .filter(Boolean)
              .join("\n"),
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

