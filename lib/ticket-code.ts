/**
 * تحويل نص رمز QR المقروء من الكاميرا إلى معرّف تذكرة صالح.
 *
 * يقبل الصيغتين معًا للتوافق العكسي:
 *   1) الحمولة الكاملة: `kawalees:ticket:KW-ABC123:<showId>` (تنسيق المنصة).
 *   2) المعرّف المجرّد: `KW-ABC123` (الإدخال اليدوي في البوابة).
 *
 * ملف نقي بلا اعتماديات — يُختبر مباشرة في `tests/unit/ticket-code.test.ts`.
 */

/** بادئة حمولة رمز QR التي تولّدها المنصة. */
export const TICKET_QR_PREFIX = "kawalees:ticket:"

/** البادئة بأحرف كبيرة — نقارن بها بعد رفع النص المقروء (الكاميرا قد ترجع أي حالة). */
const QR_PREFIX_UPPER = TICKET_QR_PREFIX.toUpperCase()

/** شكل المعرّف المقبول: حروف لاتينية/أرقام/شرطات فقط، من 4 إلى 64 خانة. */
const TICKET_ID_RE = /^[A-Z0-9][A-Z0-9-]{2,63}$/

/**
 * يستخرج معرّف التذكرة من أي نص مقروء (`""` إن لم يكن صالحًا).
 *
 * - يتجاهل المسافات والأسطر الجديدة التي تضيفها بعض الماسحات.
 * - يقصّ الأقواس والعلامات المعلّقة أحيانًا حول الرمز (`«»`, `"`, `'`).
 */
export function parseTicketCode(raw: string | null | undefined): string {
  let value = (raw ?? "").trim()
  if (value.length === 0) return ""

  // إزالة علامات التنصيص/الأقواس المتطرفة التي قد تلتقطها الكاميرا أو النسخ.
  value = value.replace(/^[«"'([{<]+/, "").replace(/[»"')\]}>\s]+$/, "")
  value = value.toUpperCase()

  // (1) حمولة المنصة الكاملة: البادئة ثم المعرّف ثم معرّف العرض.
  if (value.startsWith(QR_PREFIX_UPPER)) {
    const parts = value.split(":")
    const candidate = (parts[2] ?? "").trim()
    return TICKET_ID_RE.test(candidate) ? candidate : ""
  }

  // (2) معرّف مجرّد (إدخال يدوي أو ماسح يقرأ المعرّف وحده).
  return TICKET_ID_RE.test(value) ? value : ""
}

/** هل النص حمولة رمز QR من المنصة؟ */
export function isTicketQrPayload(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().toUpperCase().startsWith(QR_PREFIX_UPPER)
}

/**
 * مسار صورة التذكرة التي يولّدها السيرفر **عند الطلب**.
 *
 * تُحفظ هذه القيمة في `ticket_image_url` بدل رفع الصورة إلى تخزين سحابي:
 * عند ٢٥٦٠٠ تذكرة كان الرفع يستهلك ≈١.٥ جيجابايت (خارج الحصة المجانية) ويستهلك
 * معالج الاستضافة لكل تذكرة، بينما التوليد عند الطلب لا يخزّن شيئًا ويُقدَّم من
 * ذاكرة الحواف (Edge Cache) بعد أول طلب، بدقة أعلى (١٦ بكسل للوحدة).
 */
export function ticketQrImagePath(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId.trim().toUpperCase())}/qr.png`
}
