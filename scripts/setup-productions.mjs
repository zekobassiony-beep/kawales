// يتحقق من جداول مساحة العمل على Supabase (العروض/الطاقم/الأودشنات/الطلبات/الإنجازات).
//
//   node scripts/setup-productions.mjs
//
// ملاحظة: إنشاء الجداول نفسها يحتاج SQL Editor (مفاتيح الـ API لا تُنفّذ DDL)،
// لذا عند غيابها يطبع هذا السكربت الملف المطلوب تشغيله.
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

const tables = [
  { name: "productions", columns: "id, title, status, venue_kind, venue_name" },
  { name: "crew_members", columns: "id, production_id, name, email, status" },
  { name: "auditions", columns: "id, title, status, owner_email" },
  { name: "audition_applications", columns: "id, audition_id, actor_email, status" },
  { name: "achievements", columns: "id, actor_email, title" },
]

let missing = false
for (const table of tables) {
  // استعلام قراءة عادي (لا HEAD count) لأن PostgREST لا يُخطئ على جدول ناقص مع head:true.
  const { data, error } = await supabase.from(table.name).select(table.columns).limit(1)
  if (error) {
    console.error(`✗ ${table.name}: ${error.message}`)
    missing = true
  } else {
    console.log(`✓ ${table.name} — متاح (${data?.length ?? 0} صف مقروء)`)
  }
}

if (missing) {
  console.error("\nشغّل هذا الملف من SQL Editor في Supabase مرة واحدة ثم أعد المحاولة:")
  console.error("  scripts/productions-schema.sql")
  console.error("  https://supabase.com/dashboard/project/yvixrtlonpubbjxhprld/sql/new\n")
  process.exit(1)
}

console.log("\nمساحة العمل جاهزة ✓ — العروض والأودشنات والدعوات تُحفظ الآن في قاعدة البيانات.")
