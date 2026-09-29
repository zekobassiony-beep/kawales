import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  adminNotifyMode,
  escapeTelegramHtml,
  enqueueAdminNotice,
  pendingAdminNoticeCount,
  drainAdminNotices,
  telegramChatGapMs,
  throttleTelegramChat,
  TELEGRAM_CHAT_GAP_DEFAULT_MS,
  TELEGRAM_RECOMMENDED_GAP_MS,
} from "../../lib/telegram-throttle"

/** نُصفّر الفاصل حتى لا تنتظر الاختبارات لكل مهمة. */
process.env.TELEGRAM_CHAT_GAP_MS = "1"

describe("الافتراضيات (سلوك تليجرام الأصلي بلا تغيير)", () => {
  it("الوضع الافتراضي: إشعار كامل فوري لكل حجز (لا ملخّصات)", () => {
    delete process.env.TELEGRAM_ADMIN_MODE
    assert.equal(adminNotifyMode(), "instant")

    process.env.TELEGRAM_ADMIN_MODE = "digest"
    assert.equal(adminNotifyMode(), "digest")

    process.env.TELEGRAM_ADMIN_MODE = "anything-else"
    assert.equal(adminNotifyMode(), "instant", "أي قيمة غير digest تُبقي السلوك الأصلي")

    delete process.env.TELEGRAM_ADMIN_MODE
  })

  it("بلا متغيّر تباعد ⇒ لا تأخير على رسائل تليجرام", () => {
    delete process.env.TELEGRAM_CHAT_GAP_MS
    assert.equal(TELEGRAM_CHAT_GAP_DEFAULT_MS, 0)
    assert.equal(telegramChatGapMs(), 0)
    process.env.TELEGRAM_CHAT_GAP_MS = "1"
  })

  it("القيمة المقترحة للحماية تبقى متاحة عند طلبها", () => {
    assert.equal(TELEGRAM_RECOMMENDED_GAP_MS, 3_200)
  })
})

describe("escapeTelegramHtml (سلامة رسائل HTML)", () => {
  it("يهرّب الرموز التي تكسر رسائل تليجرام", () => {
    assert.equal(escapeTelegramHtml("<b>hi</b> & <i>"), "&lt;b&gt;hi&lt;/b&gt; &amp; &lt;i&gt;")
  })

  it("لا يمسّ النص العربي أو الأرقام", () => {
    assert.equal(escapeTelegramHtml("KW-123456 · ليلة في القهوة"), "KW-123456 · ليلة في القهوة")
  })
})

describe("telegramChatGapMs (التباعد الاختياري)", () => {
  it("يحترم قيمة البيئة، ويعود إلى صفر عند قيمة غير صالحة", () => {
    assert.equal(telegramChatGapMs(), 1)
    process.env.TELEGRAM_CHAT_GAP_MS = "not-a-number"
    assert.equal(telegramChatGapMs(), TELEGRAM_CHAT_GAP_DEFAULT_MS)
    process.env.TELEGRAM_CHAT_GAP_MS = "3200"
    assert.equal(telegramChatGapMs(), TELEGRAM_RECOMMENDED_GAP_MS)
    process.env.TELEGRAM_CHAT_GAP_MS = "1"
  })
})

describe("throttleTelegramChat (ترتيب الإرسال لكل محادثة)", () => {
  it("لا يُشغّل مهمتين في الوقت نفسه لنفس المحادثة ويحفظ الترتيب", async () => {
    let active = 0
    let peak = 0
    const order: number[] = []

    const run = (index: number): Promise<number> =>
      throttleTelegramChat("chat-serial-test", async () => {
        active += 1
        peak = Math.max(peak, active)
        order.push(index)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
        return index
      })

    const results = await Promise.all([run(1), run(2), run(3)])
    assert.equal(peak, 1, "لا تزامن داخل المحادثة الواحدة")
    assert.deepEqual(order, [1, 2, 3])
    assert.deepEqual(results, [1, 2, 3])
  })

  it("لا تحجب محادثةٌ محادثةً أخرى (عميلان مستقلان)", async () => {
    let slowFinished = false
    const slow = throttleTelegramChat("chat-a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
      slowFinished = true
      return "a"
    })
    const fast = throttleTelegramChat("chat-b", async () => "b")

    assert.equal(await fast, "b")
    assert.equal(slowFinished, false, "المحادثة الأخرى لم تنتظر محادثةً بطيئة")
    assert.equal(await slow, "a")
  })
})

describe("ملخّص إشعارات الإدارة (تجميع)", () => {
  it("يجمّع الحجوزات في الطابور ثم يُفرغه بنداء واحد", async () => {
    // بلا متغيّرات تليجرام في بيئة الاختبار ⇒ الإرسال يفشل بهدوء والطابور يُفرَّغ.
    assert.equal(pendingAdminNoticeCount(), 0)

    enqueueAdminNotice("<b>KW-1</b> · عرض · 2 مقعد")
    enqueueAdminNotice("<b>KW-2</b> · عرض · 1 مقعد")
    assert.equal(pendingAdminNoticeCount(), 2)

    const covered = await drainAdminNotices()
    assert.equal(covered, 0, "بلا تهيئة تليجرام لا يُرسل شيء")
    assert.equal(pendingAdminNoticeCount(), 0, "الطابور أُفرغ فلا يتراكم في الذاكرة")
  })

  it("يتجاهل السطر الفارغ", () => {
    enqueueAdminNotice("   ")
    assert.equal(pendingAdminNoticeCount(), 0)
  })
})
