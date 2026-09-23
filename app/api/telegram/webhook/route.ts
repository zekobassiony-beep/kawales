import { NextRequest, NextResponse } from "next/server"
import {
  rejectTicketOnServer,
  verifyTicketOnServer,
  type TicketDecisionResult,
} from "@/lib/ticket-registry"
import { sendTicketQrImage } from "@/lib/telegram-ticket-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TelegramCallbackQuery = {
  id: string
  data?: string
  message?: { chat?: { id: number }; message_id?: number; caption?: string }
}

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery
}

/** نداء موحّد لواجهة تليجرام (يتجاهل أي فشل شبكي حتى لا يتعطل الرد). */
async function callTelegram(token: string, method: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * يعدّل رسالة الإيصال إلى نص الحالة **ويزيل الأزرار التفاعلية**:
 * `editMessageCaption` للرسائل المصوّرة، وعند فشلها `editMessageText` للرسائل النصية.
 * في الحالتين يُرسل `reply_markup: { inline_keyboard: [] }` لمنع إعادة الضغط.
 */
async function updateReceiptMessage(token: string, chatId: number, messageId: number, text: string): Promise<void> {
  const removedButtons = { inline_keyboard: [] as never[] }

  const captionUpdated = await callTelegram(token, "editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption: text,
    parse_mode: "HTML",
    reply_markup: removedButtons,
  })
  if (captionUpdated) return

  await callTelegram(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: removedButtons,
  })
}

/** نص تأكيد قبول الحجز مع رمز QR المعروض على الموقع. */
function qrCaption(result: TicketDecisionResult): string {
  return [
    "🎟️ <b>تم قبول الحجز وتأكيد التذكرة ✅</b>",
    `🎫 الكود: <code>${result.record.ticketId}</code>`,
    result.record.showTitle ? `📌 العرض: ${result.record.showTitle}` : "",
    result.record.seatsLabel ? `💺 المقاعد: ${result.record.seatsLabel}` : "",
    "",
    "هذا هو رمز الدخول — اعرضه عند بوابة المسرح.",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * ويب هوك تليجرام: يعالج ضغطات الإدارة على أزرار الإيصال
 * (`approve_{ticketId}` / `reject_{ticketId}`).
 *
 * الترتيب مهم:
 *  1) قراءة `callback_query` من الجسم.
 *  2) `answerCallbackQuery` **فورًا** (أول نداء) لإزالة مؤشر التحميل في تليجرام.
 *  3) تطبيق القرار على التذكرة (`verifyTicket` / `applyAutomationUpdate`).
 *  4) تعديل نص الرسالة وإزالة الأزرار.
 *  5) إرسال رمز QR عند القبول.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const body = (await req.json().catch(() => null)) as TelegramUpdate | null
  const callback = body?.callback_query

  // لا يوجد ضغط زر (تحديث آخر) — نرد بالنجاح فورًا.
  if (!callback) return NextResponse.json({ ok: true })

  // (1) استخراج المعرّف والقرار من callback_data (قراءة متزامنة سريعة).
  const match = /^(approve|reject)_(.+)$/.exec(callback.data ?? "")
  const approved = match?.[1] === "approve"
  const ticketId = match ? match[2].trim().toUpperCase() : ""

  if (!token) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN غير مهيأ — لم يتم الرد على الزر (سيظل مؤشر التحميل ظاهرًا). " +
        "اضبط المتغيّر في Vercel ثم أعد تسجيل الـ webhook.",
    )
  }

  // (2) الرد الفوري على البوت — أول نداء قبل أي عملية أخرى لإزالة الـ spinner.
  if (token) {
    await callTelegram(token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: match ? (approved ? "تم القبول ✅" : "تم الرفض ❌") : "لا يوجد إجراء مطابق",
      show_alert: false,
    })
  }

  // بيانات ضغط غير معروفة: نكتفي بالرد على البوت.
  if (!match) return NextResponse.json({ ok: true, handled: false })

  // (3) تحديث حالة التذكرة في سجل الخادم (verifyTicket / applyAutomationUpdate).
  const result = approved ? verifyTicketOnServer(ticketId) : rejectTicketOnServer(ticketId)

  if (!token) return NextResponse.json({ ok: true, handled: true, status: result.status })

  // (4) تعديل نص الرسالة وإزالة الأزرار التفاعلية.
  const chatId = callback.message?.chat?.id
  const messageId = callback.message?.message_id
  if (chatId && messageId) {
    await updateReceiptMessage(token, chatId, messageId, result.message)
  }

  // (5) عند القبول: إرسال نفس رمز QR المعروض على الموقع.
  if (approved && !result.alreadyDecided) {
    await sendTicketQrImage({ qrPayload: result.record.qrPayload, chatId, caption: qrCaption(result) })
  }

  return NextResponse.json({ ok: true, handled: true, status: result.status })
}

/**
 * فحص سريع من المتصفح/أدوات المراقبة: يؤكد أن المسار يعمل وهل التوكن مهيأ
 * (مفيد بعد تغيير متغيّرات البيئة على Vercel وإعادة تسجيل الـ webhook).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
    handler: "telegram-callback-query",
  })
}


