import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import {
  buildReceiptFallbackCaption,
  decodeReceiptValue,
  isRemoteUrl,
  receiptFilenameFor,
  resolveReceiptPayload,
  sendBookingNotification,
  sendReceiptToTelegram,
  sniffReceiptMimeType,
  type BookingNotification,
  type ReceiptVerificationInput,
} from "../../lib/telegram"

/**
 * صور الإيصال: نضمن إرسال بايتات حقيقية بـ filename و contentType صريحين، وأن أي فشل
 * من تليجرام (IMAGE_PROCESS_FAILED…) ينتهي برسالة نصية تحمل بيانات الحجز + رابط الإيصال
 * بدل إفشال الحجز.
 */

/* ---------- عيّنات صغيرة ببايتات سحرية صحيحة ---------- */

const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
])
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
])
const HEIC_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
])
const GARBAGE_BYTES = new TextEncoder().encode("<html>this is not an image</html>")

function dataUrl(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`
}

/* ---------- أدوات تجهيز نداءات تليجرام ---------- */

const TELEGRAM_TOKEN = "123456:TEST-TOKEN"
const TELEGRAM_CHAT_ID = "987654321"
const REMOTE_RECEIPT_URL = "https://example.test/receipts/KW-ABC123.jpg"

const baseInput: ReceiptVerificationInput = {
  ticketId: "KW-ABC123",
  qrPayload: "kawalees:ticket:KW-ABC123:show-1",
  showTitle: "ليلة في القهوة",
  venue: "مسرح كواليس، القاهرة",
  seatsCount: 2,
  seatsLabel: "A1، A2",
  totalCents: 45_000,
  senderPhone: "01012345678",
  paymentMethod: "vodafone_cash",
}

type TelegramCall = { method: string; body: FormData | Record<string, unknown> }

let calls: TelegramCall[] = []
const originalFetch = globalThis.fetch
const originalToken = process.env.TELEGRAM_BOT_TOKEN
const originalChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

function telegramMethodOf(url: string): string {
  const match = /api\.telegram\.org\/bot[^/]+\/([A-Za-z]+)/.exec(url)
  return match ? match[1] : "unknown"
}

function readBody(init: RequestInit): FormData | Record<string, unknown> {
  const body = init.body
  if (body instanceof FormData) return body
  if (typeof body === "string") return JSON.parse(body) as Record<string, unknown>
  return {}
}

/** يزرع fetch وهمي ويسجّل كل نداء تليجرام (`handler` يعيد الاستجابة). */
function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const request = init ?? {}
    const method = telegramMethodOf(url)
    if (method !== "unknown") calls.push({ method, body: readBody(request) })
    return handler(url, request)
  }) as typeof fetch
}

function telegramOk(messageId = 7): Response {
  return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), { status: 200 })
}

function telegramFailure(description: string): Response {
  return new Response(JSON.stringify({ ok: false, error_code: 400, description }), { status: 400 })
}

function lastCall(): TelegramCall {
  const call = calls[calls.length - 1]
  assert.ok(call, "يجب أن يكون هناك نداء واحد على الأقل لتليجرام")
  return call
}

beforeEach(() => {
  calls = []
  process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_TOKEN
  process.env.TELEGRAM_ADMIN_CHAT_ID = TELEGRAM_CHAT_ID
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
  else process.env.TELEGRAM_BOT_TOKEN = originalToken
  if (originalChatId === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_ID
  else process.env.TELEGRAM_ADMIN_CHAT_ID = originalChatId
})

/* ---------- الكشف عن نوع الصورة واسم الملف ---------- */

describe("sniffReceiptMimeType", () => {
  it("يكتشف النوع الفعلي من البايتات لا من الامتداد", () => {
    assert.equal(sniffReceiptMimeType(JPEG_BYTES), "image/jpeg")
    assert.equal(sniffReceiptMimeType(PNG_BYTES), "image/png")
    assert.equal(sniffReceiptMimeType(WEBP_BYTES), "image/webp")
    assert.equal(sniffReceiptMimeType(HEIC_BYTES), "image/heic")
  })

  it("يعيد undefined للمحتوى غير المعروف أو القصير جدًا", () => {
    assert.equal(sniffReceiptMimeType(GARBAGE_BYTES), undefined)
    assert.equal(sniffReceiptMimeType(new Uint8Array([1, 2, 3])), undefined)
  })
})

describe("receiptFilenameFor", () => {
  it("يبني اسم ملف صريحًا لكل صيغة", () => {
    assert.equal(receiptFilenameFor("image/jpeg"), "receipt.jpg")
    assert.equal(receiptFilenameFor("image/png"), "receipt.png")
    assert.equal(receiptFilenameFor("image/heic"), "receipt.heic")
  })

  it("يتجاهل بارامترات الـ MIME ويعود إلى jpg عند الجهل بالصيغة", () => {
    assert.equal(receiptFilenameFor("image/jpeg; charset=utf-8"), "receipt.jpg")
    assert.equal(receiptFilenameFor("application/octet-stream"), "receipt.jpg")
  })
})

describe("isRemoteUrl", () => {
  it("يميّز الرابط العام عن data URL", () => {
    assert.equal(isRemoteUrl(REMOTE_RECEIPT_URL), true)
    assert.equal(isRemoteUrl(dataUrl("image/jpeg", JPEG_BYTES)), false)
  })
})

describe("decodeReceiptValue", () => {
  it("يفكّ data URL ويحفظ الصيغة المُعلنة", () => {
    const decoded = decodeReceiptValue(dataUrl("image/png", PNG_BYTES))
    assert.ok(decoded)
    assert.equal(decoded.mimeType, "image/png")
    assert.deepEqual(Array.from(decoded.bytes), Array.from(PNG_BYTES))
  })

  it("يرفض فكّ رابط الإيصال العام كـ Base64 (سبب IMAGE_PROCESS_FAILED سابقًا)", () => {
    assert.equal(decodeReceiptValue(REMOTE_RECEIPT_URL), null)
  })
})

describe("resolveReceiptPayload", () => {
  it("يستخدم البايتات الحقيقية لنوع الإيصال المكتشَف", async () => {
    const payload = await resolveReceiptPayload(dataUrl("image/jpeg", PNG_BYTES))
    assert.ok(payload)
    assert.equal(payload.mimeType, "image/png")
    assert.equal(payload.filename, "receipt.png")
    assert.deepEqual(Array.from(payload.bytes ?? []), Array.from(PNG_BYTES))
  })

  it("يجلب البايتات من الرابط العام المخزَّن في receipt_url", async () => {
    stubFetch(async (url) => {
      assert.equal(url, REMOTE_RECEIPT_URL)
      return new Response(PNG_BYTES, { status: 200 })
    })
    const payload = await resolveReceiptPayload(REMOTE_RECEIPT_URL)
    assert.ok(payload)
    assert.equal(payload.mimeType, "image/png")
    assert.equal(payload.filename, "receipt.png")
    assert.equal(payload.url, REMOTE_RECEIPT_URL)
    assert.deepEqual(Array.from(payload.bytes ?? []), Array.from(PNG_BYTES))
  })

  it("يبقي الرابط العام عندما يتعذّر جلبه (بلا بايتات)", async () => {
    stubFetch(async () => {
      throw new Error("network down")
    })
    const payload = await resolveReceiptPayload(REMOTE_RECEIPT_URL)
    assert.ok(payload)
    assert.equal(payload.bytes, undefined)
    assert.equal(payload.url, REMOTE_RECEIPT_URL)
  })

  it("لا يُرفق بايتات غير معروفة كصورة (رابط أرجع HTML)", async () => {
    stubFetch(async () => new Response(GARBAGE_BYTES, { status: 200 }))
    const payload = await resolveReceiptPayload(REMOTE_RECEIPT_URL)
    assert.ok(payload)
    assert.equal(payload.bytes, undefined)
    assert.equal(payload.url, REMOTE_RECEIPT_URL)
  })
})

/* ---------- الرسالة النصية البديلة ---------- */

describe("buildReceiptFallbackCaption", () => {
  it("تجمع بيانات الحجز + رابط الإيصال المباشر + سبب الفشل", () => {
    const text = buildReceiptFallbackCaption(
      baseInput,
      REMOTE_RECEIPT_URL,
      "Bad Request: IMAGE_PROCESS_FAILED",
    )
    assert.match(text, /KW-ABC123/)
    assert.match(text, /01012345678/)
    assert.match(text, /A1/)
    assert.match(text, /اطلب|قبول|رفض/)
    assert.match(text, /href="https:\/\/example\.test\/receipts\/KW-ABC123\.jpg"/)
    assert.match(text, /IMAGE_PROCESS_FAILED/)
  })

  it("توضّح غياب الرابط المباشر بدل ترك الأدمن بلا إشارة", () => {
    const text = buildReceiptFallbackCaption(baseInput)
    assert.match(text, /لا يتوفّر رابط مباشر/)
  })
})

/* ---------- إرسال الإيصال إلى تليجرام ---------- */

describe("sendReceiptToTelegram", () => {
  it("يرفق البايتات بـ filename و contentType صريحين ويحفظ أزرار القبول/الرفض", async () => {
    stubFetch(async (url) => {
      if (telegramMethodOf(url) === "sendPhoto") return telegramOk(11)
      return telegramFailure("unexpected call")
    })

    const result = await sendReceiptToTelegram({
      ...baseInput,
      receiptImage: dataUrl("image/jpeg", JPEG_BYTES),
    })

    assert.equal(result.ok, true)
    assert.equal(result.mode, "photo")
    assert.equal(result.messageId, 11)
    assert.deepEqual(calls.map((call) => call.method), ["sendPhoto"])

    const form = calls[0].body as FormData
    assert.equal(form.get("chat_id"), TELEGRAM_CHAT_ID)
    assert.equal(form.get("parse_mode"), "HTML")
    assert.match(String(form.get("caption")), /KW-ABC123/)

    const photo = form.get("photo") as unknown as File
    assert.ok(photo instanceof Blob, "يجب إرفاق صورة الإيصال كـ Blob/Buffer")
    assert.equal(photo.name, "receipt.jpg")
    assert.equal(photo.type, "image/jpeg")
    assert.deepEqual(Array.from(new Uint8Array(await photo.arrayBuffer())), Array.from(JPEG_BYTES))

    const markup = JSON.parse(String(form.get("reply_markup"))) as {
      inline_keyboard: { callback_data: string }[][]
    }
    assert.equal(markup.inline_keyboard[0][0].callback_data, "approve_KW-ABC123")
    assert.equal(markup.inline_keyboard[0][1].callback_data, "reject_KW-ABC123")
  })

  it("يكشف الصيغة الحقيقية (PNG) ويرسلها باسم receipt.png", async () => {
    stubFetch(async () => telegramOk(12))

    const result = await sendReceiptToTelegram({
      ...baseInput,
      // المتصفح قد يعلن image/jpeg بينما الملف PNG فعليًا.
      receiptImage: dataUrl("image/jpeg", PNG_BYTES),
    })

    assert.equal(result.ok, true)
    assert.equal(result.mode, "photo")
    const photo = (calls[0].body as FormData).get("photo") as unknown as File
    assert.equal(photo.name, "receipt.png")
    assert.equal(photo.type, "image/png")
  })

  it("يرسل صيغ HEIC كملف (sendDocument) لأن sendPhoto لا يدعمها", async () => {
    stubFetch(async (url) => (telegramMethodOf(url) === "sendDocument" ? telegramOk(13) : telegramFailure("Bad Request: IMAGE_PROCESS_FAILED")))

    const result = await sendReceiptToTelegram({
      ...baseInput,
      receiptImage: dataUrl("image/heic", HEIC_BYTES),
    })

    assert.equal(result.ok, true)
    assert.equal(result.mode, "document")
    assert.deepEqual(calls.map((call) => call.method), ["sendDocument"])
    const document = (calls[0].body as FormData).get("document") as unknown as File
    assert.equal(document.name, "receipt.heic")
    assert.equal(document.type, "image/heic")
  })

  it("يتحوّل إلى رسالة نصية بها بيانات الحجز + رابط الإيصال عند فشل كل محاولات الصورة", async () => {
    stubFetch(async (url) => {
      if (url === REMOTE_RECEIPT_URL) return new Response(PNG_BYTES, { status: 200 })
      if (telegramMethodOf(url) === "sendMessage") return telegramOk(21)
      return telegramFailure("Bad Request: IMAGE_PROCESS_FAILED")
    })

    const result = await sendReceiptToTelegram({
      ...baseInput,
      receiptImage: dataUrl("image/png", PNG_BYTES),
      receiptUrl: REMOTE_RECEIPT_URL,
    })

    // ⚠️ الأهم: الحجز لا يفشل — الإشعار يصل نصيًا برابط الإيصال.
    assert.equal(result.ok, true)
    assert.equal(result.mode, "text_fallback")
    assert.equal(result.messageId, 21)
    assert.match(String(result.warning), /IMAGE_PROCESS_FAILED/)
    assert.deepEqual(calls.map((call) => call.method), [
      "sendPhoto",
      "sendDocument",
      "sendPhoto",
      "sendMessage",
    ])

    const fallback = lastCall().body as Record<string, unknown>
    const text = String(fallback.text)
    assert.match(text, /KW-ABC123/)
    assert.match(text, /01012345678/)
    assert.match(text, /45\s?ج\.م|450/)
    assert.ok(text.includes(REMOTE_RECEIPT_URL), "يجب تضمين رابط الإيصال المباشر في الرسالة البديلة")
    const markup = fallback.reply_markup as { inline_keyboard: { callback_data: string }[][] }
    assert.equal(markup.inline_keyboard[0][0].callback_data, "approve_KW-ABC123")
    assert.equal(markup.inline_keyboard[0][1].callback_data, "reject_KW-ABC123")
  })

  it("لا يُفشل الإرسال عندما يكون الإيصال رابطًا عامًا غير قابل للجلب", async () => {
    stubFetch(async (url) => {
      if (url === REMOTE_RECEIPT_URL) throw new Error("storage unreachable")
      if (telegramMethodOf(url) === "sendMessage") return telegramOk(22)
      return telegramFailure("Bad Request: IMAGE_PROCESS_FAILED")
    })

    const result = await sendReceiptToTelegram({ ...baseInput, receiptImage: REMOTE_RECEIPT_URL })

    assert.equal(result.ok, true)
    assert.equal(result.mode, "text_fallback")
    assert.deepEqual(calls.map((call) => call.method), ["sendPhoto", "sendMessage"])
    assert.ok(String((lastCall().body as Record<string, unknown>).text).includes(REMOTE_RECEIPT_URL))
  })

  it("يرسل رسالة نصية عادية عند عدم وجود إيصال", async () => {
    stubFetch(async () => telegramOk(31))

    const result = await sendReceiptToTelegram(baseInput)

    assert.equal(result.ok, true)
    assert.equal(result.mode, "text")
    assert.deepEqual(calls.map((call) => call.method), ["sendMessage"])
  })

  it("يعيد خطأ واضحًا بلا أي نداء عندما تكون متغيّرات البيئة ناقصة", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_ADMIN_CHAT_ID
    stubFetch(async () => telegramOk())

    const result = await sendReceiptToTelegram({
      ...baseInput,
      receiptImage: dataUrl("image/jpeg", JPEG_BYTES),
    })

    assert.equal(result.ok, false)
    assert.equal(result.code, "not_configured")
    assert.equal(calls.length, 0)
  })
})

/* ---------- إشعار الحجز من مسار createBooking ---------- */

const bookingNotification: BookingNotification = {
  reference: "KW-BOOK01",
  eventTitle: "ليلة في القهوة",
  venueName: "مسرح كواليس",
  venueCity: "القاهرة",
  startsAt: new Date("2026-10-05T18:00:00Z"),
  customerName: "نور حسن",
  customerEmail: "nour@example.com",
  customerPhone: "01012345678",
  seats: [{ seatId: "A1", tierName: "VIP", priceCents: 30_000 }],
  subtotalCents: 30_000,
  serviceFeeCents: 5_000,
  totalCents: 35_000,
}

describe("sendBookingNotification", () => {
  it("يرفق الإيصال بصيغة صحيحة وبلا reply_markup", async () => {
    stubFetch(async () => telegramOk(41))

    await sendBookingNotification({
      ...bookingNotification,
      receipt: {
        filename: "IMG_1234.jpg",
        mimeType: "image/jpeg",
        dataBase64: Buffer.from(JPEG_BYTES).toString("base64"),
      },
    })

    assert.deepEqual(calls.map((call) => call.method), ["sendPhoto"])
    const form = calls[0].body as FormData
    assert.equal(form.get("reply_markup"), null)
    const photo = form.get("photo") as unknown as File
    assert.equal(photo.name, "receipt.jpg")
    assert.equal(photo.type, "image/jpeg")
  })

  it("لا يُفشل الحجز: يرسل رسالة نصية عند فشل تليجرام في معالجة الصورة (HEIC)", async () => {
    stubFetch(async (url) =>
      telegramMethodOf(url) === "sendDocument"
        ? telegramFailure("Bad Request: IMAGE_PROCESS_FAILED")
        : telegramOk(42),
    )

    await sendBookingNotification({
      ...bookingNotification,
      receipt: {
        filename: "IMG_5678.heic",
        mimeType: "image/heic",
        dataBase64: Buffer.from(HEIC_BYTES).toString("base64"),
      },
    })

    assert.deepEqual(calls.map((call) => call.method), ["sendDocument", "sendMessage"])
    const text = String((lastCall().body as Record<string, unknown>).text)
    assert.match(text, /KW-BOOK01/)
    assert.match(text, /تعذّر إرفاق صورة الإيصال/)
  })
})
