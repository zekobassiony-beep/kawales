// يتحقق من جدول `profiles` على Supabase (الحفظ الدائم لحساب المستخدم وملفه).
//
//   node scripts/setup-profiles.mjs
//
// ملاحظة: إنشاء الجدول نفسه يحتاج SQL Editor (مفاتيح الـ API لا تُنفّذ DDL)،
// لذا عند غياب الجدول يطبع هذا السكربت الملف المطلوب تشغيله.
import { readFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const projectRoot = path.resolve(import.meta.dirname, "..")

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

const { data, error } = await supabase
  .from("profiles")
  .select("id, email, role, onboarded, updated_at")
  .order("updated_at", { ascending: false })
  .limit(20)

if (error) {
  console.error(`جدول profiles غير متاح: ${error.message}`)
  console.error("\nشغّل هذا الملف من SQL Editor في Supabase مرة واحدة ثم أعد المحاولة:")
  console.error("  scripts/profiles-schema.sql\n")
  process.exit(1)
}

console.log(`profiles جاهز ✓ — الصفوف المعروضة: ${data?.length ?? 0}`)
for (const row of data ?? []) {
  console.log(`  - ${row.email} — ${row.role} ${row.onboarded ? "(ملف مكتمل)" : "(بانتظار إكمال البيانات)"}`)
}
