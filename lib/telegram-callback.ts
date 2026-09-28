import type { TicketStatus } from "@/lib/tickets"
import type { TicketDecisionResult } from "@/lib/ticket-registry"

/**
 * منطق أزرار الإدارة على تليجرام (`✅ قبول الحجز` / `❌ رفض الحجز`).
 *
 * وحدة **نقية** بلا أي اعتماد على `next/server` أو شبكة — حتى تُغطّى باختبارات
 * الوحدة مباشرة، وتُستخدم من الـ webhook في `app/api/telegram/webhook/route.ts`.
 */

export type CallbackAction = "approve" | "reject"

export type ParsedCallback = {
  action: CallbackAction
  ticketId: string
  /** نص `callback_data` الأصلي (للتشخيص في اللوج). */
  raw: string
}

/** صيغة مرجع التذكرة المقبولة (`KW-XXXXXX`، مع السماح بشرطات داخلية). */
const TICKET_ID_PATTERN = /^KW-[A-Z0-9-]{3,}$/

/** يفكّ `callback_data` بصيغة `approve_{ticketId}` أو `reject_{ticketId}`. */
export function parseCallbackData(data: string | null | undefined): ParsedCallback | null {
  const raw = (data ?? "").trim()
  const match = /^(approve|reject)_(.+)$/.exec(raw)
  if (!match) return null

  const ticketId = match[2].trim().toUpperCase()
  if (!TICKET_ID_PATTERN.test(ticketId)) return null

  return { action: match[1] as CallbackAction, ticketId, raw }
}

/** الرد الفوري على الزر (يوقف دوران الزر في تليجرام). */
export function callbackAckText(parsed: ParsedCallback | null): string {
  if (!parsed) return "لا يوجد إجراء مطابق"
  return parsed.action === "approve" ? "تم القبول ✅" : "تم الرفض ❌"
}

/** هل يستحق القرار توليد صورة التذكرة ونشرها؟ (مرة واحدة فقط لكل تذكرة). */
export function shouldPublishTicket(
  parsed: ParsedCallback,
  result: TicketDecisionResult | null,
): boolean {
  return Boolean(result) && parsed.action === "approve" && result?.alreadyDecided === false
}

/** نص تأكيد قبول الحجز مع رمز QR المعروض على الموقع. */
export function qrCaption(result: TicketDecisionResult): string {
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

/** نص رسالة الإيصال بعد القرار (يُعدَّل ليحمل النتيجة النهائية). */
export function decisionBanner(result: TicketDecisionResult): string {
  const head = result.status === "approved" ? "✅" : "❌"
  return [`${head} <b>${result.message}</b>`, `🎫 الكود: <code>${result.record.ticketId}</code>`].join("\n")
}

/** رسالة العميل عند اعتماد تذكرته (تُرفق معها صورة التذكرة/QR). */
export function customerApprovedNotice(ticketId: string): string {
  return `🎟️ <b>تم اعتماد تذكرتك ${ticketId} ✅</b>\nهذا رمز الدخول — اعرضه عند بوابة المسرح.`
}

/** رسالة العميل عند رفض الإيصال (أول إشعار رسمي بالرفض). */
export function customerRejectedNotice(ticketId: string): string {
  return [
    `❌ <b>تعذّر اعتماد إيصال التذكرة ${ticketId}</b>`,
    "",
    "لم نتمكّن من مطابقة التحويل. أعد رفع صورة إيصال أوضح من صفحة الحجز، أو تواصل مع فريق كواليس وسنراجع طلبك من جديد.",
  ].join("\n")
}

/** تنبيه الأدمن عند تعذّر الوصول لمحادثة العميل لإبلاغه بالقرار. */
export function adminMissingCustomerChatNotice(ticketId: string, status: TicketStatus): string {
  const what = status === "rejected" ? "رفض الإيصال" : "اعتماد التذكرة"
  return [
    `⚠️ التذكرة <code>${ticketId}</code>: تم ${what}، لكن محادثة العميل غير مربوطة بالبوت.`,
    "أبلغه عبر الهاتف/واتساب، أو اطلب منه إرسال /start مع كود التذكرة.",
  ].join("\n")
}

export type DecisionDeps = {
  approve: (ticketId: string) => Promise<TicketDecisionResult | null>
  reject: (ticketId: string) => Promise<TicketDecisionResult | null>
  log?: (message: string) => void
}

/**
 * يطبّق قرار الإدارة على التذكرة **بلا رمي أخطاء أبدًا** (سجل صريح + إرجاع null عند الفشل)
 * حتى لا يتعطّل الويب هوك ولا يدخل تليجرام في إعادة محاولات.
 */
export async function handleTicketDecision(
  parsed: ParsedCallback,
  deps: DecisionDeps,
): Promise<TicketDecisionResult | null> {
  const log = deps.log ?? ((line: string) => console.warn(line))
  try {
    const result =
      parsed.action === "approve" ? await deps.approve(parsed.ticketId) : await deps.reject(parsed.ticketId)
    log(
      `[telegram] قرار ${parsed.action} للتذكرة ${parsed.ticketId} → ${result?.status ?? "unknown"}` +
        (result?.alreadyDecided ? " (قرار سابق)" : ""),
    )
    return result
  } catch (error) {
    log(
      `[telegram] تعذّر تطبيق قرار ${parsed.action} على ${parsed.ticketId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return null
  }
}
