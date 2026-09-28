// جسر محلي لاختبار أزرار الإدارة على تليجرام **بلا نفق HTTPS**:
//   1) يحذف الويب هوك (`deleteWebhook`) ليضع البوت في وضع polling.
//   2) يقرأ التحديثات بـ `getUpdates` ويعيد توجيه كل تحديث إلى السيرفر المحلي
//      (`http://localhost:3000/api/telegram/webhook`) — أي أن ضغط الزر يصل لجهازك فعلًا.
//   3) عند الإيقاف (Ctrl+C) يعيد تسجيل الويب هوك الإنتاجي إن مُرّر `--restore`.
//
//   npm run dev                 (نافذة أولى)
//   npm run telegram:bridge     (نافذة ثانية) ثم اضغط الزر في تليجرام
//
//   node scripts/telegram-bridge.mjs --url=http://localhost:3000/api/telegram/webhook
//   node scripts/telegram-bridge.mjs --restore=https://your-domain/api/telegram/webhook
import { resolveTelegramConfig } from "../tests/load-env.mjs"

const args = process.argv.slice(2)
const readFlag = (name, fallback) => {
  const match = args.find((value) => value.startsWith(`--${name}=`))
  return match ? match.slice(name.length + 3) : fallback
}

const localUrl = readFlag("url", "http://localhost:3000/api/telegram/webhook")
const restoreUrl = readFlag("restore", "")
const { token } = resolveTelegramConfig()

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN غير مهيأ (في .env.local أو متغيّرات البيئة).")
  process.exit(1)
}

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  })
  return { status: response.status, payload: await response.json().catch(() => ({})) }
}

/** يعيد توجيه تحديث واحد إلى السيرفر المحلي ويطبع النتيجة. */
async function forward(update) {
  const data = update.callback_query?.data
  const text = update.message?.text
  const label = data ? `زر: ${data}` : text ? `رسالة: ${text.slice(0, 40)}` : `تحديث #${update.update_id}`

  try {
    const response = await fetch(localUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    })
    const body = await response.text()
    console.log(`[bridge] ${label} → ${response.status} ${body.slice(0, 160)}`)
  } catch (error) {
    console.error(`[bridge] تعذّر الوصول للسيرفر المحلي (${localUrl}): ${error.message}`)
    console.error("[bridge] تأكد من تشغيل `npm run dev` أولًا.")
  }
}

let running = true
const stop = () => {
  running = false
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)

console.log(`[bridge] إعادة التوجيه إلى: ${localUrl}`)
const deleted = await callTelegram("deleteWebhook", { drop_pending_updates: false })
console.log(`[bridge] deleteWebhook: ${deleted.status} ${JSON.stringify(deleted.payload).slice(0, 120)}`)
console.log("[bridge] البوت الآن في وضع polling — اضغط ✅/❌ في تليجرام وسيصل للجهاز. أوقف بـ Ctrl+C.\n")

let offset = 0
while (running) {
  let batch
  try {
    batch = await callTelegram("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["callback_query", "message"],
    })
  } catch (error) {
    console.error(`[bridge] فشل getUpdates: ${error.message} — إعادة المحاولة بعد 3 ثوانٍ.`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
    continue
  }

  if (!batch.payload?.ok) {
    console.error(`[bridge] getUpdates (${batch.status}): ${JSON.stringify(batch.payload).slice(0, 200)}`)
    break
  }

  for (const update of batch.payload.result ?? []) {
    offset = update.update_id + 1
    await forward(update)
  }
}

if (restoreUrl) {
  const restored = await callTelegram("setWebhook", {
    url: restoreUrl,
    allowed_updates: ["callback_query", "message"],
    drop_pending_updates: true,
  })
  console.log(`[bridge] setWebhook (${restoreUrl}): ${restored.status} ${JSON.stringify(restored.payload).slice(0, 120)}`)
} else {
  console.log("[bridge] تنبيه: لم يُعد تسجيل ويب هوك الإنتاج. أعد تسجيله بالأمر:")
  console.log("         node tests/telegram-webhook.mjs https://<your-domain>/api/telegram/webhook")
}
