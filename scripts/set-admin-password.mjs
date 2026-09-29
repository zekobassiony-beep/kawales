// يعيّن كلمة مرور حقيقية لحساب سوبر أدمن على Supabase Auth (بمفتاح الخدمة).
//
//   node scripts/set-admin-password.mjs                      # تقرير فقط (بلا تعديل)
//   node scripts/set-admin-password.mjs --apply --password="كلمة المرور"
//   node scripts/set-admin-password.mjs --apply --generate    # توليد كلمة قوية وطبعها مرة واحدة
//
// متغيّرات بديلة: NEW_ADMIN_PASSWORD (كلمة المرور) و ADMIN_EMAIL (البريد).
// كلمة المرور لا تُطبع أبدًا إلا عند استخدام --generate.
import { readFileSync } from "node:fs"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const projectRoot = path.resolve(import.meta.dirname, "..")
const DEFAULT_EMAIL = "zeko.bassiony@gmail.com"
const MIN_LENGTH = 6

function readEnvLocal() {
  const env = {}
  for (const file of [".env.local", "app/.env.local"]) {
    try {
      const contents = readFileSync(path.join(projectRoot, file), "utf8")
      for (const line of contents.split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (match) env[match[1]] = match[2].replace(/^"(.*)"$/, "$1")
      }
    } catch {
      // الملف غير موجود — نتجاهل.
    }
  }
  return env
}

function argValue(flag) {
  const prefix = `--${flag}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ""
}

const env = readEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY غير مهيأة في .env.local")
  process.exit(1)
}

const apply = process.argv.includes("--apply")
const generate = process.argv.includes("--generate")
const email = (argValue("email") || process.env.ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase()
let password = argValue("password") || process.env.NEW_ADMIN_PASSWORD || ""

if (generate && !password) password = `Kw-${randomBytes(9).toString("base64url")}`

if (apply && password.length < MIN_LENGTH) {
  console.error(`كلمة المرور مطلوبة (${MIN_LENGTH} أحرف على الأقل): استخدم --password=... أو --generate`)
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

/** يبحث عن المستخدم بالبريد في الصفحات الأولى (200 مستخدم لكل صفحة). */
async function findUserByEmail(target) {
  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error(`تعذّر البحث عن المستخدم: ${error.message}`)
      process.exit(1)
    }
    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? "").trim().toLowerCase() === target)
    if (match) return match
    if (users.length < 200) break
  }
  return null
}

const user = await findUserByEmail(email)
if (!user) {
  console.error(`لا يوجد حساب بهذا البريد على Supabase Auth: ${email}`)
  process.exit(1)
}

const appMeta = user.app_metadata ?? {}
const providers = Array.isArray(appMeta.providers) ? appMeta.providers : [appMeta.provider].filter(Boolean)

console.log("حالة الحساب الحالية:")
console.log(`  - البريد: ${user.email}`)
console.log(`  - المعرّف: ${user.id}`)
console.log(`  - مزوّدو الدخول: ${providers.join(", ") || "-"}`)
console.log(`  - البريد مؤكَّد: ${user.email_confirmed_at ? "نعم" : "لا"}`)
console.log(`  - آخر دخول: ${user.last_sign_in_at ?? "لا يوجد"}`)

if (!apply) {
  console.log("\nهذا تقرير فقط — لم يُعدَّل شيء.")
  console.log("لتعيين كلمة مرور جديدة شغّل:")
  console.log(`  node scripts/set-admin-password.mjs --apply --email=${email} --password="..."`)
  process.exit(0)
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true })
if (error) {
  console.error(`تعذّر تعيين كلمة المرور: ${error.message}`)
  process.exit(1)
}

console.log(`\nتمّ تعيين كلمة مرور جديدة للحساب ✓ (${email})`)
if (generate) {
  console.log(`كلمة المرور المولَّدة (احفظها الآن — لن تُعرض مرة أخرى): ${password}`)
} else {
  console.log("كلمة المرور هي التي أدخلتها — لم تُطبَع في السجل.")
}
console.log("يمكنك الآن الدخول من /login بالتويب «تسجيل الدخول»، أو المتابعة بحساب Google كما كان.")
