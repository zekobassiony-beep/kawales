// يتحقق فعليًا من قناة التليجرام: يرسل رسالة «حجز تجريبي» لشات الأدمن.
//
//   node tests/telegram-check.mjs
import { resolveTelegramConfig } from "./load-env.mjs"

const { token, chatId } = resolveTelegramConfig()
if (!token || !chatId) {
  console.error("TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID غير مهيأة.")
  process.exit(1)
}

const text = [
  "🎭 <b>كواليس — فحص قناة التليجرام</b>",
  "",
  "لو وصلتك هذه الرسالة فالقناة شغالة، وإشعارات الحجوزات ستصلك هنا.",
  `الوقت: ${new Date().toISOString()}`,
].join("\n")

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
})
const payload = await response.json().catch(() => ({}))
if (response.ok && payload.ok) {
  console.log(`TELEGRAM OK — message_id ${payload.result?.message_id}`)
} else {
  console.error(`TELEGRAM FAILED (${response.status}): ${JSON.stringify(payload).slice(0, 300)}`)
  process.exit(1)
}