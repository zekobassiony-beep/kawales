// يُسجّل ويب هوك التليجرام ويطبع حالته — لتشخيص مشكلة "أزرار لا تستجيب" على Vercel.
//
//   node tests/telegram-webhook.mjs https://<your-domain>/api/telegram/webhook
//   node tests/telegram-webhook.mjs --info        (فحص الحالة بدون تسجيل)
import { resolveTelegramConfig } from "./load-env.mjs"

const { token } = resolveTelegramConfig()
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN غير مهيأ (في .env.local أو متغيّرات البيئة).")
  process.exit(1)
}

const args = process.argv.slice(2)
const infoOnly = args.includes("--info")
const url = args.find((value) => value.startsWith("http")) ?? ""

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  })
  return { status: response.status, payload: await response.json().catch(() => ({})) }
}

if (!infoOnly) {
  if (!url) {
    console.error("مرّر رابط الـ webhook، مثل: https://kawalees.vercel.app/api/telegram/webhook")
    process.exit(1)
  }
  const registered = await callTelegram("setWebhook", {
    url,
    allowed_updates: ["callback_query", "message"],
    drop_pending_updates: true,
  })
  console.log(`setWebhook (${registered.status}):`, JSON.stringify(registered.payload))
  if (!registered.payload?.ok) process.exit(1)
}

const info = await callTelegram("getWebhookInfo", {})
const result = info.payload?.result ?? {}
console.log("getWebhookInfo:", JSON.stringify({
  url: result.url,
  pending_update_count: result.pending_update_count,
  last_error_date: result.last_error_date,
  last_error_message: result.last_error_message,
  allowed_updates: result.allowed_updates,
}))
console.log(
  result.url
    ? "الويب هوك مسجّل ✓ — إن ظلّ الزر يدور بلا رد، تأكد من TELEGRAM_BOT_TOKEN في بيئة السيرفر (GET /api/telegram/webhook يعيد configured:true)."
    : "الويب هوك غير مسجّل ✗ — شغّل السكربت مع الرابط لإصلاح الأزرار.",
)
