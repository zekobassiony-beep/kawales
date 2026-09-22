import { NextRequest, NextResponse } from "next/server"
import { setTicketStatusOnServer } from "@/lib/ticket-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * ويب هوك تليجرام: يستقبل التفاعل مع أزرار الإدارة المضمّنة
 * (`approve_{ticketId}` / `reject_{ticketId}`) ويُحدّث حالة التذكرة في سجل
 * الخادم، ثم يرد على البوت لتحديث الرسالة.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN

  const body = (await req.json().catch(() => null)) as
    | { callback_query?: { id: string; data?: string; message?: { chat?: { id: number }; message_id?: number } } }
    | null

  const callback = body?.callback_query
  if (!callback) return NextResponse.json({ ok: true })

  const data = callback.data ?? ""
  const match = /^(approve|reject)_(.+)$/.exec(data)
  if (match) {
    const decision = match[1] === "approve" ? "approved" : "rejected"
    const ticketId = match[2].toUpperCase()
    setTicketStatusOnServer(ticketId, decision)

    const confirmation = decision === "approved" ? "تم القبول ✅" : "تم الرفض ❌"
    if (token) {
      // رد فوري على البوت (toast).
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id, text: confirmation }),
      }).catch(() => undefined)

      // تحديث رسالة التليجرام (إزالة الأزرار + توضيح القرار).
      const chatId = callback.message?.chat?.id
      const messageId = callback.message?.message_id
      if (chatId && messageId) {
        await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
        }).catch(() => undefined)
        await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            caption: confirmation,
            parse_mode: "HTML",
          }),
        }).catch(() => undefined)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
