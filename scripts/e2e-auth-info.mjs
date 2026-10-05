// مساعد وضع اختبار E2E: يطبع السرّ وروابط الدخول الجاهزة، ويمكنه التحقق فعليًا.
//
//   node scripts/e2e-auth-info.mjs                                  # طباعة الإعدادات والروابط
//   node scripts/e2e-auth-info.mjs --check=http://127.0.0.1:3000    # تحقق فعلي + فحص بوابة الأدمن
//   node scripts/e2e-auth-info.mjs --base=http://127.0.0.1:3000 --role=troupe --next=/dashboard/producer
//
// للقراءة فقط — لا يعدّل أي شيء.
import { loadEnvLocal } from "../tests/load-env.mjs"

const env = loadEnvLocal()
const value = (key) => (process.env[key] ?? env[key] ?? "").trim()

const flag = value("KAWALEES_E2E_AUTH")
const token = value("KAWALEES_E2E_AUTH_TOKEN")
const emails = value("KAWALEES_E2E_AUTH_EMAILS")
const email = value("KAWALEES_E2E_AUTH_EMAIL") || "admin@kawalees.test"
const enabled = ["1", "true", "yes", "on"].includes(flag.toLowerCase()) && token.length > 0

function argValue(name, fallback = "") {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

const base = (argValue("base") || argValue("check") || "http://127.0.0.1:3000").replace(/\/+$/, "")
const role = argValue("role", "troupe")
const next = argValue("next", "/dashboard/producer")

console.log(`وضع اختبار E2E — الحالة: ${enabled ? "مُفعَّل ✓" : "معطّل ✗"}`)
if (!enabled) {
  console.log(`  السبب: KAWALEES_E2E_AUTH=${JSON.stringify(flag)} / token=${token ? "مضبوط" : "فارغ"}`)
  console.log("  أضف KAWALEES_E2E_AUTH=\"1\" و KAWALEES_E2E_AUTH_TOKEN=\"…\" إلى .env.local ثم أعد التفعيل.")
  process.exit(0)
}

const allowList = Array.from(new Set([email, ...emails.split(/[,\s;]+/).filter(Boolean)]))
console.log(`  السرّ:         ${token}`)
console.log(`  بريدات مسموحة: ${allowList.join(", ")}`)

const loginUrl = `${base}/api/e2e/auth?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}&next=${encodeURIComponent(next)}`
const logoutUrl = `${base}/api/e2e/auth?token=${encodeURIComponent(token)}&action=logout`

console.log("\nروابط جاهزة للمشغّل الآلي:")
console.log(`  GET  ${loginUrl}`)
console.log(`  GET  ${logoutUrl}`)
console.log(`  POST ${base}/api/e2e/auth   {"token":"…","role":"${role}","next":"${next}"}`)

if (!argValue("check")) {
  console.log(`\nللتحقق الفعلي أثناء تشغيل السيرفر:\n  node scripts/e2e-auth-info.mjs --check=${base}`)
  process.exit(0)
}

try {
  const login = await fetch(loginUrl, { redirect: "manual" })
  const jars = typeof login.headers.getSetCookie === "function" ? login.headers.getSetCookie() : []
  const cookieHeader = jars.map((entry) => entry.split(";")[0]).join("; ")
  console.log(
    `\nنتيجة التحقق: الدخول = ${login.status}${jars.length ? ` + ${jars.length} كوكي جلسة` : " (بلا كوكيز!)"}`,
  )

  const guarded = await fetch(`${base}/producer`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
  const location = guarded.headers.get("location") ?? ""
  const denied = location.includes("/login")
  console.log(`  GET /producer بالجلسة = ${guarded.status}${location ? ` → ${location}` : ""}`)
  console.log(denied ? "  ✗ بوابة الأدمن رفضت الحساب التجريبي" : "  ✓ بوابة الأدمن مرّرت الحساب التجريبي")
  process.exit(denied || login.status >= 400 ? 1 : 0)
} catch (error) {
  console.error(`تعذّر التحقق: ${error.message} — هل السيرفر يعمل على ${base}؟`)
  process.exit(1)
}
