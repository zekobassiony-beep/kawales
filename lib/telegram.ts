/**
 * إشعارات تليجرام لإدارة كواليس.
 *
 * بعد إتمام الحجز يتلقى الأدمن رسالة بتفاصيل التذكرة ورقم الهاتف،
 * ولو أرفق العميل إيصال الدفع تُرسل الصورة مرفقة بالتفاصيل.
 * الوحدة لا ترمي أخطاء أبدًا حتى لا يتعطّل الحجز إن كان البوت غير مهيأ.
 */

export type BookingNotificationReceipt = {
  filename: string
  mimeType: string
  dataBase64: string
}

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
    if (booking.receipt?.mimeType.startsWith("image/")) {
      const bytes = Uint8Array.from(Buffer.from(booking.receipt.dataBase64, "base64"))
      const form = new FormData()
      form.append("chat_id", chatId)
      form.append("caption", caption)
      form.append("parse_mode", "HTML")
      form.append(
        "photo",
        new Blob([bytes as BlobPart], { type: booking.receipt.mimeType }),
        booking.receipt.filename,
      )
      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      })
      if (!response.ok) {
        const text = await response.text()
        console.error(`[telegram] sendPhoto failed (${response.status}): ${text}`)
        return
      }
      return
    }

    // بلا إيصال صورة: رسالة نصية فقط.
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML" }),
    })
    if (!response.ok) {
      const text = await response.text()
      console.error(`[telegram] sendMessage failed (${response.status}): ${text}`)
    }
  } catch (error) {
    console.error(`[telegram] notification failed: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * إرسال إيصال التحويل إلى إدارة كواليس على تليجرام مع أزرار قبول/رفض
 * (Inline Keyboard). تُستدعى من إجراء سيرفر (`app/actions/telegram.ts`).
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
  receiptImage?: string
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
 * يرسل صورة الإيصال (أو رسالة نصية عند عدم وجودها) مع Inline Keyboard
 * بزرّي `✅ قبول الحجز` و`❌ رفض الحجز`.
 */
export async function sendReceiptToTelegram(input: ReceiptVerificationInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID غير مهيأة — تخطّي إرسال الإيصال.")
    return
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

  try {
    if (input.receiptImage) {
      const base64 = input.receiptImage.replace(/^data:[^;]+;base64,/, "")
      const bytes = Uint8Array.from(Buffer.from(base64, "base64"))
      const form = new FormData()
      form.append("chat_id", chatId)
      form.append("caption", caption)
      form.append("parse_mode", "HTML")
      form.append("reply_markup", JSON.stringify(replyMarkup))
      form.append("photo", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "receipt.jpg")
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form })
      return
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: replyMarkup }),
    })
  } catch (error) {
    console.error(`[telegram] sendReceiptToTelegram failed: ${error instanceof Error ? error.message : error}`)
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
