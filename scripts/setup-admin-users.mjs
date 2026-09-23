// يتحقق من جدول admin_users على Supabase ويُدرج السوبر أدمن الأساسي.
//
//   node scripts/setup-admin-users.mjs
//
// ملاحظة: إنشاء الجدول نفسه يحتاج SQL Editor (مفاتيح الـ API لا تُنفّذ DDL)،
// لذا عند غياب الجدول يطبع هذا السكربت الملف المطلوب تشغيله.
import { readFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const projectRoot = path.resolve(import.meta.dirname, "..")
const MASTER_ADMIN_EMAIL = "zeko.bassiony@gmail.com"

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

const env = readEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY غير مهيأة في .env.local")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { error: readError } = await supabase.from("admin_users").select("email").limit(1)
if (readError) {
  console.error(`جدول admin_users غير متاح: ${readError.message}`)
  console.error("\nشغّل هذا الملف من SQL Editor في Supabase ثم أعد المحاولة:")
  console.error("  scripts/admin-users-schema.sql\n")
  process.exit(1)
}

const { error: insertError } = await supabase
  .from("admin_users")
  .upsert({ email: MASTER_ADMIN_EMAIL }, { onConflict: "email" })

if (insertError) {
  console.error(`تعذّر إدراج السوبر أدمن: ${insertError.message}`)
  process.exit(1)
}

const { data, error: listError } = await supabase.from("admin_users").select("email").order("created_at")
if (listError) {
  console.error(`تعذّر قراءة القائمة: ${listError.message}`)
  process.exit(1)
}

console.log("admin_users جاهز ✓ — القائمة الحالية:")
for (const row of data ?? []) console.log(`  - ${row.email}`)
