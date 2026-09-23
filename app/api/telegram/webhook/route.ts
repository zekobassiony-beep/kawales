import { NextRequest, NextResponse, after } from "next/server"
import {
  rejectTicketOnServer,
  verifyTicketOnServer,
  type TicketDecisionResult,
} from "@/lib/ticket-registry"
import { sendTicketQrImage } from "@/lib/telegram-ticket-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** استجابة 200 مؤكدة — تمنع تليجرام من إعادة المحاولة (re-tries) عند أي خطأ داخلي. */
function okResponse(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: true, ...extra }, { status: 200 })
}

/** وصف مختصر لأي خطأ داخل اللوج بلا انهيار. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
 * مصمّم لبيئة Vercel Serverless:
 *  1) قراءة `callback_query` من الجسم (بلا انهيار على جسم غير صالح).
 *  2) `answerCallbackQuery` **فورًا** داخل `try/catch` مستقلة تمامًا (لا تُعطّل أي خطوة قادمة).
 *  3) تطبيق القرار على التذكرة مباشرة — يُنشئ سجلًا مؤقتًا إن لم تكن التذكرة في ذاكرة
 *     هذه النسخة (اختلاف نسخ Vercel) دون أي Exception.
 *  4) تعديل نص الرسالة وإرسال رمز QR **بعد** إرسال الاستجابة عبر `after()` (بلا تعليق).
 *  5) استجابة `{ ok: true }` بـ 200 دائمًا حتى لا يتعطّل البوت أو يدخل في Re-tries.
 */
export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const body = (await req.json().catch(() => null)) as TelegramUpdate | null
    const callback = body?.callback_query

    // لا يوجد ضغط زر (تحديث آخر) — استجابة 200 فورية.
    if (!callback) return okResponse()

    // (1) استخراج المعرّف والقرار من callback_data (قراءة متزامنة سريعة).
    const match = /^(approve|reject)_(.+)$/.exec(callback.data ?? "")
    const approved = match?.[1] === "approve"
    const ticketId = match ? match[2].trim().toUpperCase() : ""

    // (2) الرد الفوري على البوت — كتلة try/catch مستقلة لمنع تعليق الزر (spinner).
    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callback.id,
            text: match ? (approved ? "تم القبول ✅" : "تم الرفض ❌") : "لا يوجد إجراء مطابق",
            show_alert: false,
          }),
        })
      } catch (error) {
        console.warn(`[telegram] answerCallbackQuery تعذّر: ${describeError(error)}`)
      }
    } else {
      console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN غير مهيأ — لم يتم الرد على الزر. " +
          "اضبط المتغيّر في Vercel ثم أعد تسجيل الـ webhook.",
      )
    }

    // بيانات ضغط غير معروفة: نكتفي بالرد على البوت.
    if (!match) return okResponse({ handled: false })

    // (3) تحديث حالة التذكرة فورًا — آمن على أي نسخة (يُنشئ سجلًا مؤقتًا عند الغياب).
    let result: TicketDecisionResult | null = null
    try {
      result = approved ? await verifyTicketOnServer(ticketId) : await rejectTicketOnServer(ticketId)
    } catch (error) {
      console.warn(`[telegram] تعذّر تحديث حالة التذكرة ${ticketId}: ${describeError(error)}`)
    }

    // (4) تعديل نص الرسالة + إرسال رمز QR في الخلفية بعد الاستجابة (لا تعليق للويب هوك).
    //     نعتمد على chat_id/message_id الواردَين في التحديث نفسه، فلا يهم أي نسخة Vercel عالجت الضغط.
    const chatId = callback.message?.chat?.id
    const messageId = callback.message?.message_id
    const decision = result
    if (token && decision) {
      try {
        after(async () => {
          if (chatId && messageId) {
            await updateReceiptMessage(token, chatId, messageId, decision.message)
          }
          if (approved && !decision.alreadyDecided) {
            await sendTicketQrImage({ qrPayload: decision.record.qrPayload, chatId, caption: qrCaption(decision) })
          }
        })
      } catch (error) {
        // في حال عدم توفّر سياق `after`: نكمل بلا تعليق الاستجابة.
        console.warn(`[telegram] تعذّر جدولة تحديث الرسالة في الخلفية: ${describeError(error)}`)
      }
    }

    // (5) استجابة 200 مؤكدة دائمًا.
    return okResponse({ handled: true, status: decision?.status ?? "unknown" })
  } catch (error) {
    // أي خطأ غير متوقع: نسجّله ونُرجع 200 (حتى لا يدخل تليجرام في إعادة محاولات).
    console.error(`[telegram] فشل غير متوقع في الويب هوك: ${describeError(error)}`)
    return okResponse({ handled: false, error: "internal" })
  }
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


