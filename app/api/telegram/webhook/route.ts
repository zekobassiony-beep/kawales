import { NextRequest, NextResponse, after } from "next/server"
import {
  getTelegramChatId,
  linkTelegramChat,
  publishTicketImage,
  rejectTicketOnServer,
  verifyTicketOnServer,
} from "@/lib/ticket-registry"
import { sendTicketQrImage } from "@/lib/telegram-ticket-image"
import {
  adminMissingCustomerChatNotice,
  callbackAckText,
  customerApprovedNotice,
  customerRejectedNotice,
  decisionBanner,
  handleTicketDecision,
  parseCallbackData,
  qrCaption,
  shouldPublishTicket,
} from "@/lib/telegram-callback"
import { fetchWithTimeout } from "@/lib/with-timeout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** مهلة كافية لمهام `after()` (توليد QR + رفع الصورة + إرسال بطاقة التذكرة للعميل). */
export const maxDuration = 60

/** مهلة كل نداء على واجهة تليجرام (تليجرام ينتظر 60s، لكننا لا نُعطّل الويب هوك). */
const TELEGRAM_TIMEOUT_MS = 6000

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
  message?: { text?: string; chat?: { id: number } }
}

/** نداء موحّد لواجهة تليجرام (مهل محدودة + تجاهل أي فشل شبكي حتى لا يتعطل الرد). */
async function callTelegram(token: string, method: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      TELEGRAM_TIMEOUT_MS,
      `telegram.${method}`,
    )
    return response.ok
  } catch (error) {
    console.warn(`[telegram] ${method} تعذّر: ${describeError(error)}`)
    return false
  }
}

/**
 * يتحقق من سرّ الويب هوك عند ضبط `TELEGRAM_WEBHOOK_SECRET` (يمنع تزوير ضغطات الأزرار
 * من جهات خارجية). بلا السرّ يظل المسار متاحًا (بيئة تطوير).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return true
  return req.headers.get("x-telegram-bot-api-secret-token") === secret
}

/**
 * ينفّذ العمل بعد إرسال الاستجابة إلى تليجرام (`after`) حتى لا نُعطّل الويب هوك،
 * ويعود إلى التشغيل المباشر إن غاب سياق الطلب (بلا رمي أخطاء).
 */
function scheduleAfter(task: () => Promise<void>, label: string): void {
  const guarded = async (): Promise<void> => {
    try {
      await task()
    } catch (error) {
      console.error(`[telegram] ${label}: ${describeError(error)}`)
    }
  }
  try {
    after(guarded)
  } catch (error) {
    console.warn(`[telegram] تعذّر جدولة «${label}» (${describeError(error)}) — تشغيل مباشر بلا انتظار.`)
    void guarded()
  }
}

/**
 * يعدّل رسالة الإيصال إلى نص القرار **ويزيل الأزرار التفاعلية**.
 * ثلاث محاولات مضمونة: `editMessageCaption` (رسائل مصوّرة/ملفات) →
 * `editMessageText` (رسائل نصية) → رسالة جديدة (حتى لا يفقد الأدمن تأكيد القرار أبدًا).
 */
async function updateReceiptMessage(
  token: string,
  chatId: number,
  messageId: number | undefined,
  text: string,
): Promise<void> {
  const removedButtons = { inline_keyboard: [] as never[] }

  if (!messageId) {
    await callTelegram(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" })
    return
  }

  const captionUpdated = await callTelegram(token, "editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption: text,
    parse_mode: "HTML",
    reply_markup: removedButtons,
  })
  if (captionUpdated) return

  const textUpdated = await callTelegram(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: removedButtons,
  })
  if (textUpdated) return

  console.warn(`[telegram] تعذّر تعديل رسالة الإيصال ${messageId} — نرسل رسالة جديدة بالنتيجة.`)
  await callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text: `${text}\n\n<i>(تعذّر تعديل رسالة الإيصال الأصلية)</i>`,
    parse_mode: "HTML",
  })
}

/**
 * فحص تشخيصي من المتصفح: يؤكد أن المسار يعمل وهل التوكن مهيأ.
 * مع `?check=1` يجلب حالة الويب هوك من تليجرام (`getWebhookInfo`) بلا كشف التوكن —
 * أسرع طريقة لتشخيص «الأزرار لا تستجيب» على الإنتاج.
 */
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const configured = Boolean(token && process.env.TELEGRAM_ADMIN_CHAT_ID)
  const base = {
    ok: true,
    configured,
    secretProtected: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    handler: "telegram-callback-query",
  }

  if (req.nextUrl.searchParams.get("check") !== "1" || !token) return NextResponse.json(base)

  try {
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
      { method: "GET", cache: "no-store" },
      TELEGRAM_TIMEOUT_MS,
      "telegram.getWebhookInfo",
    )
    const payload = (await response.json().catch(() => null)) as
      | {
          result?: {
            url?: string
            pending_update_count?: number
            last_error_message?: string
            allowed_updates?: string[]
          }
        }
      | null
    return NextResponse.json({ ...base, webhook: payload?.result ?? null })
  } catch (error) {
    return NextResponse.json({ ...base, webhook: null, error: describeError(error) })
  }
}

/**
 * ويب هوك تليجرام: يعالج ضغطات الإدارة على أزرار الإيصال
 * (`approve_{ticketId}` / `reject_{ticketId}`) ورسائل `/start KW-XXXXXX` لربط العميل.
 *
 * مصمّم لبيئة Serverless:
 *  1) الرد الفوري على الزر (`answerCallbackQuery`) بأولوية مطلقة — يوقف دوران الزر.
 *  2) تطبيق القرار على التذكرة: `pending → approved` (ويُولَّد QR ويُخزَّن في
 *     `ticket_image_url`) أو `pending → rejected`، مع دعم تكرار الضغط (idempotent).
 *  3) تعديل رسالة الإيصال (وإزالة الأزرار) + إرسال التذكرة للإدارة والعميل **بعد**
 *     إرسال الاستجابة عبر `after()` (بلا تعليق).
 *  4) استجابة `{ ok: true }` بـ 200 دائمًا حتى لا يدخل تليجرام في إعادة محاولات.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      console.warn("[telegram] ويب هوك مرفوض: هيدر السرّ غير مطابق لـ TELEGRAM_WEBHOOK_SECRET.")
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    const body = (await req.json().catch(() => null)) as TelegramUpdate | null

    // رسالة عادية (وليست ضغط زر): قد تكون `/start KW-XXXXXX` لربط محادثة العميل.
    const message = body?.message
    if (message?.text && message.chat?.id) {
      if (/^\/start(\s|$)/i.test(message.text.trim())) {
        const ticketId = message.text.replace(/^\/start\s*/i, "").trim().toUpperCase()
        if (ticketId) {
          await linkTelegramChat(ticketId, message.chat.id)
          if (token) {
            await callTelegram(token, "sendMessage", {
              chat_id: message.chat.id,
              text: `🎭 أهلًا بك في بوت كواليس!\nربطنا محادثتك بالتذكرة ${ticketId} — فور اعتماد إيصالك ستصلك بطاقة التذكرة ورمز QR هنا.`,
            })
          }
        }
      }
      return okResponse()
    }

    const callback = body?.callback_query
    if (!callback) return okResponse()

    const parsed = parseCallbackData(callback.data)
    const chatId = callback.message?.chat?.id
    const messageId = callback.message?.message_id

    // (1) الرد الفوري على الزر قبل أي عمل شبكي ثقيل (يمنع دوران الزر للأبد).
    if (token) {
      const answered = await callTelegram(token, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: callbackAckText(parsed),
        show_alert: false,
      })
      if (!answered) {
        console.warn("[telegram] تعذّر الرد على الزر — تحقق من TELEGRAM_BOT_TOKEN في بيئة السيرفر.")
      }
    } else {
      console.warn(
        "[telegram] TELEGRAM_BOT_TOKEN غير مهيأ — لم يتم الرد على الزر. " +
          "اضبط المتغيّر في بيئة النشر ثم أعد تسجيل الـ webhook.",
      )
    }

    if (!parsed) {
      console.warn(`[telegram] callback_data غير معروف: ${JSON.stringify(callback.data ?? null)}`)
      return okResponse({ handled: false, reason: "unknown_action" })
    }

    // (2) تطبيق القرار على التذكرة (pending → approved | rejected) — بلا رمي أخطاء.
    const decision = await handleTicketDecision(parsed, {
      approve: (id) => verifyTicketOnServer(id),
      reject: (id) => rejectTicketOnServer(id),
    })

    if (!decision) {
      if (token && chatId) {
        scheduleAfter(async () => {
          await callTelegram(token, "sendMessage", {
            chat_id: chatId,
            text: `⚠️ تعذّر تطبيق القرار على التذكرة <code>${parsed.ticketId}</code> — راجع لوج السيرفر.`,
            parse_mode: "HTML",
          })
        }, "تنبيه فشل القرار")
      }
      return okResponse({ handled: true, status: "failed" })
    }

    // (3) تعديل رسالة الإيصال + توليد/إرسال بطاقة التذكرة + إبلاغ العميل بعد الاستجابة.
    if (token) {
      const publishTicket = shouldPublishTicket(parsed, decision)
      scheduleAfter(async () => {
        if (chatId) {
          await updateReceiptMessage(token, chatId, messageId, decisionBanner(decision))
        }

        if (publishTicket) {
          // (أ) التليجرام مولّد التذكرة: نولّد صورة QR ونخزّن رابطها ليعرضها الموقع (Viewer).
          const published = await publishTicketImage(parsed.ticketId, decision.record.qrPayload)
          if (!published) {
            console.error(
              `[telegram] فشل نشر صورة التذكرة ${parsed.ticketId} — تحقق من bucket «tickets» ` +
                "(node scripts/setup-storage-buckets.mjs) وترحيل الأعمدة (scripts/tickets-telegram.sql).",
            )
          }
          // (ب) إرسال التذكرة إلى محادثة الإدارة (نفس رمز QR المعروض على الموقع).
          if (chatId) {
            await sendTicketQrImage({
              qrPayload: decision.record.qrPayload,
              chatId,
              caption: qrCaption(decision),
            })
          }
          // (ج) إرسال التذكرة للعميل إن ربط محادثته بالبوت، وإلا نُنبّه الأدمن.
          const customerChatId = await getTelegramChatId(parsed.ticketId)
          if (customerChatId) {
            await sendTicketQrImage({
              qrPayload: decision.record.qrPayload,
              chatId: customerChatId,
              caption: customerApprovedNotice(parsed.ticketId),
            })
          } else {
            console.warn(
              `[telegram] لا توجد محادثة مربوطة بالتذكرة ${parsed.ticketId} — اطلب من العميل إرسال /start مع كود التذكرة.`,
            )
            if (chatId) {
              await callTelegram(token, "sendMessage", {
                chat_id: chatId,
                text: adminMissingCustomerChatNotice(parsed.ticketId, decision.status),
                parse_mode: "HTML",
              })
            }
          }
          return
        }

        if (parsed.action === "approve") {
          // ضغط متكرر على «قبول»: لا نُعيد النشر، لكن نُرسل التذكرة للعميل إن كانت محادثته مربوطة.
          const repeatChatId = await getTelegramChatId(parsed.ticketId)
          if (repeatChatId) {
            await sendTicketQrImage({
              qrPayload: decision.record.qrPayload,
              chatId: repeatChatId,
              caption: customerApprovedNotice(parsed.ticketId),
            })
          }
          return
        }

        // (د) الرفض: إبلاغ العميل، أو تنبيه الأدمن عند تعذّر الوصول لمحادثة العميل.
        const rejectedCustomerChatId = await getTelegramChatId(parsed.ticketId)
        if (rejectedCustomerChatId) {
          await callTelegram(token, "sendMessage", {
            chat_id: rejectedCustomerChatId,
            text: customerRejectedNotice(parsed.ticketId),
            parse_mode: "HTML",
          })
        } else {
          console.warn(`[telegram] التذكرة ${parsed.ticketId} مرفوضة ومحادثة العميل غير مربوطة — تنبيه الأدمن.`)
          if (chatId) {
            await callTelegram(token, "sendMessage", {
              chat_id: chatId,
              text: adminMissingCustomerChatNotice(parsed.ticketId, decision.status),
              parse_mode: "HTML",
            })
          }
        }
      }, "معالجة القرار")
    }

    // (4) استجابة 200 مؤكدة دائمًا.
    return okResponse({ handled: true, status: decision.status })
  } catch (error) {
    // أي خطأ غير متوقع: نسجّله ونُرجع 200 (حتى لا يدخل تليجرام في إعادة محاولات).
    console.error(`[telegram] فشل غير متوقع في الويب هوك: ${describeError(error)}`)
    return okResponse({ handled: false, error: "internal" })
  }
}

