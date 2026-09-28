/**
 * إشعارات تليجرام لإدارة كواليس.
 *
 * بعد إتمام الحجز يتلقى الأدمن رسالة بتفاصيل التذكرة ورقم الهاتف،
 * ولو أرفق العميل إيصال الدفع تُرسل الصورة مرفقة بالتفاصيل.
 * الوحدة لا ترمي أخطاء أبدًا حتى لا يتعطّل الحجز إن كان البوت غير مهيأ.
 */

import { fetchWithTimeout } from "@/lib/with-timeout"

export type BookingNotificationReceipt = {
  filename: string
  mimeType: string
  dataBase64: string
}

/** مهلة نداءات واجهة تليجرام (تمنع تعليق الحجز/الإجراء على بطء الشبكة). */
const TELEGRAM_TIMEOUT_MS = 8000

export type BookingNotification = {
  reference: string
  eventTitle: string
  venueName: string
  venueCity: string
  startsAt: Date
  customerName: string
  customerEmail: string
  customerPhone: string
  seats: { seatId: string; tierName: string; priceCents: number }[]
  subtotalCents: number
  serviceFeeCents: number
  totalCents: number
  receipt?: BookingNotificationReceipt
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** تهريب قيمة داخل خاصية HTML (href) — يضيف علامة التنصيص. */
function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function formatEgp(cents: number): string {
  return `${Math.round(cents) / 100} ج.م`
}

function formatCairo(value: Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  })
    .format(value)
    .replace(/[‎‏؜]/g, "")
    .replace(/ /g, " ")
    .trim()
}

/* ---------- تجهيز صورة الإيصال قبل الإرسال إلى تليجرام ---------- */

/**
 * أنواع MIME التي يقبلها `sendPhoto` فعليًا. أي صيغة أخرى (HEIC/HEIF من هواتف
 * iPhone، PDF، TIFF…) تُرسل كـ «ملف» عبر `sendDocument` لتفادي IMAGE_PROCESS_FAILED.
 */
export const TELEGRAM_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/** المهلة القصوى لجلب صورة الإيصال من الرابط العام (10 ثوانٍ). */
const RECEIPT_FETCH_TIMEOUT_MS = 10_000

/** امتداد الملف لكل نوع MIME معروف (لبناء اسم ملف صريح). */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/avif": "avif",
  "application/pdf": "pdf",
}

/** هل القيمة رابط HTTP(S) عام يمكن فتحه من المتصفح؟ */
export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

/**
 * يكتشف نوع الصورة من بايتاتها (Magic Bytes) بدل الثقة في الامتداد أو الصيغة
 * المُعلنة — وهو أصل أخطاء `IMAGE_PROCESS_FAILED` عند إرسال `contentType`/اسم ملف
 * غير مطابقين للمحتوى الفعلي.
 */
export function sniffReceiptMimeType(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined
  const ascii = (start: number, end: number): string => {
    let out = ""
    for (let index = start; index < end && index < bytes.length; index += 1) {
      out += String.fromCharCode(bytes[index])
    }
    return out
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp"
  if (ascii(0, 4) === "%PDF") return "application/pdf"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  // HEIC/HEIF (صور iPhone): صندوق `ftyp` في البايت 4 مع brand معروف.
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase()
    if (brand.startsWith("hei") || brand === "mif1" || brand === "msf1") return "image/heic"
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
  return undefined
}

/** اسم ملف صريح للإيصال حسب نوعه (`receipt.jpg` / `receipt.png` …). */
export function receiptFilenameFor(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(";")[0].trim()
  return `receipt.${MIME_EXTENSIONS[normalized] ?? "jpg"}`
}

/** يفكّ Base64 (خام أو داخل data URL) إلى بايتات مع التحقق من صحته. */
function base64ToBytes(payload: string, mimeType: string): { bytes: Uint8Array; mimeType: string } | null {
  const clean = payload.replace(/\s+/g, "")
  // نرفض أي قيمة ليست Base64 صالحًا (مثل رابط https) حتى لا نفكّ بايتات تالفة.
  if (clean.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(clean)) return null
  const bytes = Uint8Array.from(Buffer.from(clean, "base64"))
  return bytes.length > 0 ? { bytes, mimeType } : null
}

/** يفكّ data URL أو Base64 خام إلى بايتات + الصيغة المُعلنة (أو null عند التعذّر). */
export function decodeReceiptValue(value: string): { bytes: Uint8Array; mimeType: string } | null {
  const trimmed = value.trim()
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(trimmed)
  if (match) {
    const declared = (match[1] || "image/jpeg").toLowerCase()
    const payload = match[3] ?? ""
    if (match[2] === ";base64") return base64ToBytes(payload, declared)
    try {
      const bytes = new TextEncoder().encode(decodeURIComponent(payload))
      return bytes.length > 0 ? { bytes, mimeType: declared } : null
    } catch {
      return null
    }
  }
  return base64ToBytes(trimmed, "image/jpeg")
}

/** يخمّن نوع الملف من امتداد الرابط العام. */
function mimeTypeFromUrl(url: string): string | undefined {
  const path = url.split("?")[0].split("#")[0].toLowerCase()
  const extension = path.slice(path.lastIndexOf(".") + 1)
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    gif: "image/gif",
    bmp: "image/bmp",
    pdf: "application/pdf",
  }
  return map[extension]
}

/** يجلب بايتات صورة الإيصال من رابطها العام (بلا رمي أخطاء). */
async function fetchReceiptBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      { cache: "no-store" },
      RECEIPT_FETCH_TIMEOUT_MS,
      "receipt.download",
    )
    if (!response.ok) {
      console.warn(`[telegram] تعذّر جلب صورة الإيصال من الرابط العام (HTTP ${response.status}).`)
      return null
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0) {
      console.warn("[telegram] الرابط العام للإيصال أرجع ملفًا فارغًا.")
      return null
    }
    return bytes
  } catch (error) {
    console.warn(`[telegram] تعذّر جلب صورة الإيصال: ${error instanceof Error ? error.message : error}`)
    return null
  }
}

/** صورة إيصال جاهزة للإرسال: بايتات فعلية + نوع MIME + اسم ملف صريح + رابط عام. */
export type ReceiptPayload = {
  /** بايتات الصورة (تُغلق عند تعذّر جلبها من الرابط العام). */
  bytes?: Uint8Array
  /** نوع MIME الفعلي للصورة (مكتشَف من البايتات عند توفرها). */
  mimeType: string
  /** اسم الملف المرفق مع الطلب — صريح دائمًا (`receipt.jpg`…). */
  filename: string
  /** رابط عام مباشر لفتح الإيصال من المتصفح (يُستعمل في البديل النصي). */
  url?: string
}

/**
 * يوحّد مصادر صورة الإيصال (data URL من المتصفح، Base64 خام، أو رابط عام مخزَّن في
 * `receipt_url`) إلى بايتات حقيقية + نوع MIME + اسم ملف صريح.
 *
 * ملاحظة مهمة: تمرير رابط HTTPS مباشرة إلى `Buffer.from(..., "base64")` كان يولّد
 * بايتات تالفة ويسبب `Bad Request: IMAGE_PROCESS_FAILED` — لذلك نفصل الحالتين.
 */
export async function resolveReceiptPayload(raw?: string, knownUrl?: string): Promise<ReceiptPayload | null> {
  const value = raw?.trim() ?? ""
  const link = knownUrl?.trim() || (isRemoteUrl(value) ? value : "")

  // (1) الأولوية للبايتات الموجودة في اليد (data URL/Base64) — بلا أي نداء شبكي إضافي
  //     ولا تنزيل الصورة مرة أخرى بعد رفعها على Storage.
  if (value.length > 0 && !isRemoteUrl(value)) {
    const decoded = decodeReceiptValue(value)
    if (decoded) {
      const mimeType = sniffReceiptMimeType(decoded.bytes) ?? decoded.mimeType
      return {
        bytes: decoded.bytes,
        mimeType,
        filename: receiptFilenameFor(mimeType),
        url: link || undefined,
      }
    }
  }

  // (2) لا بايتات محلية: نجلبها من الرابط العام (إن وُجد) بدل الاعتماد على تليجرام.
  if (!link) return null
  const fallbackMime = mimeTypeFromUrl(link) ?? "image/jpeg"
  const bytes = await fetchReceiptBytes(link)
  const sniffed = bytes ? sniffReceiptMimeType(bytes) : undefined
  // بايتات غير معروفة (مثل رابط أرجع HTML) لا تُرفق أبدًا — نمرّر الرابط بدلًا منها
  // حتى لا يقع تليجرام في IMAGE_PROCESS_FAILED بسبب ملف تالف.
  if (!bytes || !sniffed) {
    if (bytes && !sniffed) {
      console.warn(
        "[telegram] تعذّر التعرّف على صيغة صورة الإيصال من بايتاتها — سيُمرَّر الرابط العام لتليجرام.",
      )
    }
    return { mimeType: fallbackMime, filename: receiptFilenameFor(fallbackMime), url: link }
  }
  return { bytes, mimeType: sniffed, filename: receiptFilenameFor(sniffed), url: link }
}

/** يبني FormData لإرفاق صورة الإيصال بـ filename و contentType صريحين. */
function receiptMediaForm(
  chatId: string,
  caption: string,
  replyMarkup: unknown,
  payload: ReceiptPayload,
  field: "photo" | "document",
): FormData {
  const bytes = payload.bytes ?? new Uint8Array()
  const form = new FormData()
  form.append("chat_id", chatId)
  form.append("caption", caption)
  form.append("parse_mode", "HTML")
  // لا نرسل `reply_markup` إلا عند وجوده فعليًا (تليجرام يرفض "undefined" كنص).
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup))
  form.append(field, new Blob([bytes as BlobPart], { type: payload.mimeType }), payload.filename)
  return form
}

function buildCaption(booking: BookingNotification): string {
  const lines: string[] = [
    "🎭 <b>حجز جديد — كواليس</b>",
    "",
    `📌 العرض: <b>${escapeHtml(booking.eventTitle)}</b>`,
    `🏛️ المكان: ${escapeHtml(booking.venueName)}، ${escapeHtml(booking.venueCity)}`,
    `🕗 الموعد: ${escapeHtml(formatCairo(booking.startsAt))}`,
    `🎟️ المرجع: <code>${escapeHtml(booking.reference)}</code>`,
    "",
    "👤 الاسم: " + escapeHtml(booking.customerName),
    "📞 الهاتف: " + escapeHtml(booking.customerPhone),
    "✉️ البريد: " + escapeHtml(booking.customerEmail),
    "",
    "💺 المقاعد:",
    ...booking.seats.map(
      (seat) =>
        `• ${escapeHtml(seat.seatId)} — ${escapeHtml(seat.tierName)} — ${formatEgp(seat.priceCents)}`,
    ),
    "",
    `المجموع الفرعي: ${formatEgp(booking.subtotalCents)}`,
    `رسوم الخدمة: ${formatEgp(booking.serviceFeeCents)}`,
    `💰 <b>الإجمالي: ${formatEgp(booking.totalCents)}</b>`,
  ]
  if (booking.receipt) {
    lines.push("", `🧾 إيصال مرفق: ${escapeHtml(booking.receipt.filename)}`)
  }
  return lines.join("\n")
}

export async function sendBookingNotification(booking: BookingNotification): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID غير مهيأة — تخطّي الإشعار.")
    return
  }

  const caption = buildCaption(booking)
  try {
    if (booking.receipt) {
      // نجهّز الإيصال كبايتات حقيقية + نوع MIME مكتشَف + اسم ملف صريح.
      const payload = await resolveReceiptPayload(
        `data:${booking.receipt.mimeType};base64,${booking.receipt.dataBase64}`,
      )
      if (payload?.bytes) {
        const isPhoto = TELEGRAM_PHOTO_MIME_TYPES.has(payload.mimeType)
        const result = await callTelegramBot(
          token,
          isPhoto ? "sendPhoto" : "sendDocument",
          receiptMediaForm(chatId, caption, undefined, payload, isPhoto ? "photo" : "document"),
        )
        if (result.ok) return
        console.error(
          `[telegram] تعذّر إرسال إيصال الحجز ${booking.reference} (${result.error}) — التحويل إلى رسالة نصية.`,
        )
      }
      // Fallback: لا نُسقط الإشعار أبدًا — نرسل التفاصيل نصيًا مع اسم ملف الإيصال.
      const fallback = await callTelegramBot(
        token,
        "sendMessage",
        JSON.stringify({
          chat_id: chatId,
          text: `${caption}\n\n⚠️ تعذّر إرفاق صورة الإيصال في تليجرام — راجع الإيصال من لوحة الطلبات.`,
          parse_mode: "HTML",
        }),
        "application/json",
      )
      if (!fallback.ok) {
        console.error(`[telegram] فشل إشعار الحجز ${booking.reference}: ${fallback.error}`)
      }
      return
    }

    // بلا إيصال صورة: رسالة نصية فقط.
    const result = await callTelegramBot(
      token,
      "sendMessage",
      JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML" }),
      "application/json",
    )
    if (!result.ok) {
      console.error(`[telegram] sendMessage failed: ${result.error}`)
    }
  } catch (error) {
    console.error(`[telegram] notification failed: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * إرسال إيصال التحويل إلى إدارة كواليس على تليجرام مع أزرار قبول/رفض
 * (Inline Keyboard). تُستدعى من الـ Trigger الموحّد في `app/actions/tickets`.
 */

export type ReceiptVerificationInput = {
  ticketId: string
  /** حمولة رمز QR (نفس ما يُعرض على الموقع) — تُستخدم لإرسال نفس الرمز عند القبول. */
  qrPayload: string
  showTitle: string
  venue: string
  seatsCount: number
  seatsLabel: string
  totalCents: number
  senderPhone: string
  /** صورة الإيصال: data URL من المتصفح أو رابطها العام المخزَّن في `receipt_url`. */
  receiptImage?: string
  /**
   * الرابط العام المباشر للإيصال (`receipt_url`) — يُستخدم في البديل النصي كي يفتحه
   * الأدمن من المتصفح مباشرة عند تعذّر إرفاق الصورة في تليجرام.
   */
  receiptUrl?: string
  paymentMethod: string
}

function buildReceiptCaption(input: ReceiptVerificationInput): string {
  return [
    "🧾 <b>إيصال تحويل جديد — بانتظار المراجعة</b>",
    "",
    `🎟️ <b>${escapeHtml(input.ticketId)}</b>`,
    `📌 العرض: ${escapeHtml(input.showTitle)}`,
    `🏛️ المكان: ${escapeHtml(input.venue)}`,
    `💺 المقاعد (${input.seatsCount}): ${escapeHtml(input.seatsLabel)}`,
    `💰 المبلغ: ${formatEgp(input.totalCents)}`,
    `📞 رقم المحوّل: <code>${escapeHtml(input.senderPhone)}</code>`,
    `💳 الوسيلة: ${escapeHtml(input.paymentMethod)}`,
    "",
    "استخدم الأزرار أدناه للقبول أو الرفض.",
  ].join("\n")
}

/**
 * يبني الرسالة النصية البديلة عند تعذّر إرسال صورة الإيصال (IMAGE_PROCESS_FAILED…):
 * كل بيانات الحجز + رابط الإيصال المباشر ليفتحه الأدمن من المتصفح، والأزرار تبقى فعّالة.
 */
export function buildReceiptFallbackCaption(
  input: ReceiptVerificationInput,
  receiptUrl?: string,
  reason?: string,
): string {
  const lines = [
    buildReceiptCaption(input),
    "",
    "⚠️ <b>تعذّر إرفاق صورة الإيصال في تليجرام</b> — الحجز محفوظ، راجع الإيصال من الرابط التالي:",
  ]
  if (receiptUrl && isRemoteUrl(receiptUrl)) {
    lines.push(`🔗 <a href="${escapeHtmlAttribute(receiptUrl)}">فتح صورة الإيصال في المتصفح</a>`)
    lines.push(escapeHtml(receiptUrl))
  } else {
    lines.push("لا يتوفّر رابط مباشر لهذا الإيصال — افتح لوحة الطلبات على الموقع لمراجعة الصورة.")
  }
  if (reason) lines.push(`<i>السبب: ${escapeHtml(reason)}</i>`)
  return lines.join("\n")
}

/** كيف أُرسلت رسالة الإيصال فعليًا (للتشخيص في اللوج). */
export type TelegramSendMode = "photo" | "photo_url" | "document" | "text" | "text_fallback"

export type TelegramSendResult = {
  ok: boolean
  /** رسالة الخطأ المختصرة عند الفشل. */
  error?: string
  /** تصنيف الفشل لتسهيل التشخيص في اللوج. */
  code?: "not_configured" | "api_error" | "network"
  /** معرّف الرسالة المرسلة عند النجاح. */
  messageId?: number
  /** الوسيلة الفعلية التي وصلت بها الرسالة (صورة/ملف/نص). */
  mode?: TelegramSendMode
  /** تحذير غير مُعطِّل: فشل جزء من العملية وتم استخدام بديل (مثل البديل النصي). */
  warning?: string
}

/**
 * يستدعي Telegram Bot API مع تسجيل صريح للنجاح/الفشل (بما في ذلك سبب الفشل
 * من حقل `description`). لا يرمي استثناءات أبدًا — يعيد نتيجة منظّمة دائمًا.
 */
export async function callTelegramBot(
  token: string,
  method: string,
  body: BodyInit,
  contentType?: string,
): Promise<TelegramSendResult> {
  try {
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
        body,
      },
      TELEGRAM_TIMEOUT_MS,
      `telegram.${method}`,
    )
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { message_id?: number } }
      | null

    if (!response.ok || payload?.ok === false) {
      const reason = payload?.description || `HTTP ${response.status}`
      console.error(`[telegram] ${method} فشل (HTTP ${response.status}): ${reason}`)
      return { ok: false, error: reason, code: "api_error" }
    }

    console.log(`[telegram] ${method} نجح ✓ (message_id=${payload?.result?.message_id ?? "?"})`)
    return { ok: true, messageId: payload?.result?.message_id }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[telegram] ${method} تعذّر الاتصال بـ Telegram API: ${reason}`)
    return { ok: false, error: reason, code: "network" }
  }
}

/**
 * يرسل صورة الإيصال (أو رسالة نصية عند عدم وجودها) مع Inline Keyboard
 * بزرّي `✅ قبول الحجز` و`❌ رفض الحجز`.
 *
 * سلسلة الحماية (لا يُفشل الحجز أبدًا):
 *  1) إرفاق البايتات الحقيقية بـ filename و contentType صريحين عبر `sendPhoto`.
 *  2) للصيغ غير المدعومة (HEIC/PDF…) أو عند فشل الصورة: `sendDocument` لنفس البايتات.
 *  3) إمرار الرابط العام إلى تليجرام ليجلب الملف بنفسه.
 *  4) البديل الأخير: رسالة نصية بكل بيانات الحجز + رابط الإيصال المباشر (`receipt_url`).
 */
export async function sendReceiptToTelegram(input: ReceiptVerificationInput): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    const missing = [!token && "TELEGRAM_BOT_TOKEN", !chatId && "TELEGRAM_ADMIN_CHAT_ID"]
      .filter(Boolean)
      .join(", ")
    console.error(`[telegram] تعذّر إرسال طلب التذكرة ${input.ticketId}: ${missing} غير مهيأ في بيئة السيرفر.`)
    return { ok: false, error: `متغيّرات البيئة غير مهيأة: ${missing}`, code: "not_configured" }
  }

  const caption = buildReceiptCaption(input)
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ قبول الحجز", callback_data: `approve_${input.ticketId}` },
        { text: "❌ رفض الحجز", callback_data: `reject_${input.ticketId}` },
      ],
    ],
  }

  /** رسالة نصية للأدمن (مع استمرار عمل أزرار القبول/الرفض). */
  const sendText = async (
    text: string,
    mode: TelegramSendMode,
    warning?: string,
  ): Promise<TelegramSendResult> => {
    const result = await callTelegramBot(
      token,
      "sendMessage",
      JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup }),
      "application/json",
    )
    return result.ok ? { ...result, mode, warning } : result
  }

  try {
    console.log(`[telegram] إرسال طلب التذكرة ${input.ticketId} إلى الإدارة (chat_id=${chatId})…`)

    const receipt = await resolveReceiptPayload(input.receiptImage, input.receiptUrl)

    // بلا إيصال: رسالة نصية مباشرة (السلوك القديم).
    if (!receipt) return sendText(caption, "text")

    console.log(
      `[telegram] الإيصال ${input.ticketId}: mime=${receipt.mimeType} file=${receipt.filename} ` +
        `bytes=${receipt.bytes?.length ?? 0} url=${receipt.url ? "نعم" : "لا"}`,
    )

    const isPhotoFormat = TELEGRAM_PHOTO_MIME_TYPES.has(receipt.mimeType)
    const attempts: { mode: TelegramSendMode; label: string; run: () => Promise<TelegramSendResult> }[] = []

    if (receipt.bytes && isPhotoFormat) {
      attempts.push({
        mode: "photo",
        label: "sendPhoto(buffer)",
        run: () =>
          callTelegramBot(
            token,
            "sendPhoto",
            receiptMediaForm(chatId, caption, replyMarkup, receipt, "photo"),
          ),
      })
    }
    if (receipt.bytes) {
      attempts.push({
        mode: "document",
        label: "sendDocument(buffer)",
        run: () =>
          callTelegramBot(
            token,
            "sendDocument",
            receiptMediaForm(chatId, caption, replyMarkup, receipt, "document"),
          ),
      })
    }
    if (receipt.url) {
      attempts.push({
        mode: "photo_url",
        label: "sendPhoto(url)",
        run: () =>
          callTelegramBot(
            token,
            "sendPhoto",
            JSON.stringify({
              chat_id: chatId,
              photo: receipt.url,
              caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
            "application/json",
          ),
      })
    }

    const failures: string[] = []
    for (const attempt of attempts) {
      const result = await attempt.run()
      if (result.ok) {
        if (failures.length > 0) {
          console.warn(
            `[telegram] أُرسل إيصال التذكرة ${input.ticketId} عبر ${attempt.label} بعد فشل: ${failures.join(" | ")}`,
          )
        }
        return {
          ...result,
          mode: attempt.mode,
          warning: failures.length > 0 ? failures.join(" | ") : undefined,
        }
      }
      failures.push(`${attempt.label}: ${result.error ?? "خطأ غير معروف"}`)
      console.error(`[telegram] ${attempt.label} فشل لطلب التذكرة ${input.ticketId}: ${result.error}`)
    }

    // (4) البديل الأخير: رسالة نصية ببيانات الحجز + رابط الإيصال — الحجز لا يفشل.
    const reason = failures.join(" | ") || "لم تتوفّر بايتات صالحة لصورة الإيصال."
    const fallback = await sendText(buildReceiptFallbackCaption(input, receipt.url, reason), "text_fallback", reason)
    if (fallback.ok) {
      console.warn(
        `[telegram] تم التحويل إلى رسالة نصية مع رابط الإيصال للتذكرة ${input.ticketId} — ${reason}`,
      )
      return fallback
    }
    const combined = [reason, fallback.error].filter(Boolean).join(" | ")
    console.error(`[telegram] فشل إرسال الإيصال والبديل النصي للتذكرة ${input.ticketId}: ${combined}`)
    return { ...fallback, error: combined, mode: "text_fallback" }
  } catch (error) {
    // لا نرمي أبدًا: فشل إشعار تليجرام يجب ألا يُسقط الحجز.
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[telegram] فشل غير متوقع في إرسال إيصال التذكرة ${input.ticketId}: ${reason}`)
    const fallback = await sendText(
      buildReceiptFallbackCaption(input, input.receiptUrl, reason),
      "text_fallback",
      reason,
    )
    return fallback
  }
}

export function sendTelegramNotification(message: string): void {
  const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) return
  void fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
  }).catch(() => undefined)
}
