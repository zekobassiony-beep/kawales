/**
 * منظّم إرسال تليجرام — **أدوات حماية اختيارية** لا تغيّر سلوك الإرسال الافتراضي.
 *
 * ⚠️ القاعدة الحاكمة هنا: طريقة المنصة في تليجرام (إشعار لكل حجز + أزرار
 * «قبول/رفض» + بطاقة التذكرة للعميل) هي **المسار الأساسي** ولا تُلمس. هذا الملف
 * لا يُرسل شيئًا بنفسه ولا يمنع رسالة، بل يوفّر طبقتين **معطّلتين افتراضيًا**:
 *
 *  1) `throttleTelegramChat` — تباعد اختياري بين رسائل المحادثة الواحدة، لتجنّب
 *     ردّ تليجرام `429 Too Many Requests` عند الذروة. **الفاصل الافتراضي = ٠**
 *     (بلا أي تأخير) ⇒ السلوك مطابق تمامًا لما قبل.
 *  2) `enqueueAdminNotice` — **ملخّص دوري** لو رغبت في تفعيله بدل الإشعار لكل حجز
 *     (مفيد لو صار عدد الحجوزات أكبر من أن يتحمّله حدّ المجموعة).
 *
 * التفعيل الاختياري:
 *  - `TELEGRAM_CHAT_GAP_MS=3200` ⇒ تباعد ≈١٨ رسالة/دقيقة (حماية من 429).
 *  - `TELEGRAM_ADMIN_MODE=digest` ⇒ ملخّصات بدل الإشعار الفوري لكل حجز.
 *
 * الوضع الافتراضي = إشعار كامل فوري لكل حجز، كما بُني من الأصل.
 */

import { callTelegramBot, type TelegramSendResult } from "@/lib/telegram"

/** فاصل **مقترح** عند رغبتك في تفعيل الحماية (≈١٨ رسالة/دقيقة — تحت حد المجموعة ٢٠). */
export const TELEGRAM_RECOMMENDED_GAP_MS = 3_200

/** الافتراضي: بلا تباعد ⇒ لا تغيير في سلوك تليجرام المعتاد. */
export const TELEGRAM_CHAT_GAP_DEFAULT_MS = 0

/**
 * الفاصل الفعلي بين الرسائل لنفس المحادثة.
 *
 * الافتراضي **صفر** (بلا تأخير). فعّل الحماية بمتغيّر `TELEGRAM_CHAT_GAP_MS`
 * (قيمة مقترحة: `3200`) إن ظهر في اللوج ردّ `429 Too Many Requests`.
 */
export function telegramChatGapMs(): number {
  const raw = process.env.TELEGRAM_CHAT_GAP_MS
  if (raw === undefined || raw.trim() === "") return TELEGRAM_CHAT_GAP_DEFAULT_MS
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : TELEGRAM_CHAT_GAP_DEFAULT_MS
}

/** أقصى عدد أسطر في رسالة الملخّص الواحدة (الباقي يُلخَّص بعدد). */
export const ADMIN_DIGEST_MAX_LINES = 40

/** أقصى عدد أسطر نُبقيها في الذاكرة انتظارًا للملخّص (حماية من تضخّم الذاكرة). */
const ADMIN_DIGEST_BUFFER_LIMIT = 500

export type AdminNotifyMode = "instant" | "digest"

/**
 * وضع إشعارات الإدارة.
 *
 * **الافتراضي `instant`: إشعار كامل فوري لكل حجز** — وهو أسلوب المنصة في تليجرام
 * كما بُني (بطاقة الإيصال + أزرار «قبول/رفض»)، ولا يتغيّر إلا بقرار صريح منك.
 *
 * `TELEGRAM_ADMIN_MODE=digest` يفعّل ملخّصًا دوريًا **اختياريًا** بدل الإشعار الفوري
 * (نافع فقط لو تجاوز حجم الحجوزات قدرة حدّ المجموعة في تليجرام).
 */
export function adminNotifyMode(): AdminNotifyMode {
  return (process.env.TELEGRAM_ADMIN_MODE ?? "instant").trim().toLowerCase() === "digest"
    ? "digest"
    : "instant"
}

/* ---------- (١) تباعد الإرسال لكل محادثة ---------- */

type ChatQueue = { chain: Promise<unknown>; lastSentAt: number }

const chatQueues = new Map<string, ChatQueue>()

/**
 * يُرسل المهمة في طابور خاص بالمحادثة: بلا تزامن، وبفاصل زمني أدنى بين الرسائل.
 *
 * أي فشل في مهمة لا يوقف الطابور، ولا يصل الفشل إلى المتصل إلا من مهمته هو.
 */
export function throttleTelegramChat<T>(
  chatId: string | number,
  task: () => Promise<T>,
): Promise<T> {
  const key = String(chatId)
  const queue = chatQueues.get(key) ?? { chain: Promise.resolve(), lastSentAt: 0 }

  const run = queue.chain.then(async () => {
    const wait = Math.max(0, queue.lastSentAt + telegramChatGapMs() - Date.now())
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    queue.lastSentAt = Date.now()
    return task()
  })

  queue.chain = run.then(
    () => undefined,
    () => undefined,
  )
  chatQueues.set(key, queue)
  return run
}

/** عدد المحادثات التي عليها طوابير الآن (للرصد والاختبار). */
export function telegramQueueSize(): number {
  return chatQueues.size
}

/* ---------- (٢) تجميع إشعارات الإدارة ---------- */

/** يهرّب القيم قبل إدراجها في رسالة HTML لتليجرام. */
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

type AdminNotice = { line: string }

const adminBuffer: AdminNotice[] = []
let adminFlushTimer: ReturnType<typeof setTimeout> | undefined

/** يبني جسم `sendMessage` بصيغة HTML. */
function textForm(chatId: string | number, html: string): FormData {
  const form = new FormData()
  form.append("chat_id", String(chatId))
  form.append("text", html)
  form.append("parse_mode", "HTML")
  form.append("disable_web_page_preview", "true")
  return form
}

/** يرسل رسالة نصية إلى محادثة الإدارة (مع احتساب الطابور). */
export async function sendAdminText(html: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.error("[telegram] تعذّر إرسال الملخّص: TELEGRAM_BOT_TOKEN أو TELEGRAM_ADMIN_CHAT_ID غير مهيأ.")
    return { ok: false, error: "TELEGRAM_NOT_CONFIGURED", code: "not_configured" }
  }
  return throttleTelegramChat(chatId, () =>
    callTelegramBot(token, "sendMessage", textForm(chatId, html)),
  )
}

/** يُرسل ما تراكم من أسطر في رسالة واحدة، ويعيد عدد الحجوزات التي غطّاها. */
export async function flushAdminDigest(): Promise<number> {
  if (adminFlushTimer) {
    clearTimeout(adminFlushTimer)
    adminFlushTimer = undefined
  }
  if (adminBuffer.length === 0) return 0

  const batch = adminBuffer.splice(0, adminBuffer.length)
  const shown = batch.slice(0, ADMIN_DIGEST_MAX_LINES)
  const hidden = batch.length - shown.length

  const header =
    `<b>⏱ ملخّص حجوزات جديدة (${batch.length})</b>\n` +
    (hidden > 0 ? `<i>تُعرض أحدث ${shown.length} — والباقي (${hidden}) في لوحة التحكم.</i>\n` : "")
  const body = shown.map((notice) => `• ${notice.line}`).join("\n")
  const footer =
    "\n\n<i>الاعتماد والرفض من لوحة التحكم — وللعودة إلى إشعار فوري لكل حجز: احذف المتغيّر TELEGRAM_ADMIN_MODE</i>"

  const result = await sendAdminText(`${header}${body}${footer}`)
  if (!result.ok) {
    console.error(`[telegram] فشل إرسال ملخّص الإدارة (${batch.length} حجزًا): ${result.error}`)
    return 0
  }
  console.log(`[telegram] أُرسل ملخّص إدارة واحد يغطّي ${batch.length} حجزًا.`)
  return batch.length
}

/** يضمن وجود مؤقّت إرسال للملخّص بعد `delayMs` (مؤقّت واحد فقط في كل مرة). */
function scheduleAdminFlush(delayMs: number): void {
  if (adminFlushTimer) return
  const timer = setTimeout(() => {
    adminFlushTimer = undefined
    void flushAdminDigest()
  }, Math.max(0, delayMs))
  // لا نُبقي العملية حيّة بسبب مؤقّت التجميع.
  if (typeof timer === "object" && timer && "unref" in timer) {
    ;(timer as unknown as { unref: () => void }).unref()
  }
  adminFlushTimer = timer
}

/**
 * يضمن إفراغ الملخّص **داخل دورة الطلب الحالية**.
 *
 * ⚠️ سبب وجودها: في بيئة بلا خادم لا يعيش المؤقّت بعد إرجاع الاستجابة، فلو اتّكلنا
 * على مؤقّت وحده لضاعت الملخّصات. لذا يُنتظر بقية نافذة التجميع داخل مهمة
 * `after()` (المشروع يوفّرها عبر `runInBackground`)، ثم يُرسل ما تراكم.
 *
 * النداءات المتزامنة لا تُنتج رسائل مكرّرة: أول من يصل يُفرغ الطابور، والبقية
 * تجد طابورًا فارغًا فتنتهي فورًا (وما وصل أثناء الانتظار يُضمّ في نفس الرسالة).
 */
export async function ensureAdminDigestFlushed(): Promise<number> {
  if (adminBuffer.length === 0 && !adminFlushTimer) return 0
  await new Promise((resolve) => setTimeout(resolve, telegramChatGapMs()))
  return flushAdminDigest()
}

/**
 * يضيف سطر إشعار إلى ملخّص الإدارة (وضع `digest`).
 *
 * `urgent` يتجاوز التجميع ويُرسل فورًا (حالة تستحق انتباهًا لحظيًا).
 */
export function enqueueAdminNotice(line: string, options?: { urgent?: boolean }): void {
  const clean = line.trim()
  if (!clean) return

  if (options?.urgent) {
    void sendAdminText(`<b>⚠ يحتاج انتباهًا</b>\n${clean}`)
    return
  }

  adminBuffer.push({ line: clean })
  // حماية الذاكرة: لو تجاوز الطابور سقفه، نُفرغه الآن بدل أن ينمو بلا حد.
  if (adminBuffer.length >= ADMIN_DIGEST_BUFFER_LIMIT) {
    void flushAdminDigest()
    return
  }
  // تجميع لما يصل خلال نافذة التباعد نفسها ⇒ رسالة واحدة للدفعة الواحدة.
  scheduleAdminFlush(telegramChatGapMs())
}

/** عدد الإشعارات المنتظرة في الملخّص (للرصد والاختبار). */
export function pendingAdminNoticeCount(): number {
  return adminBuffer.length
}

/** تفريغ فوري (للتشخيص والاختبار). */
export async function drainAdminNotices(): Promise<number> {
  return flushAdminDigest()
}

