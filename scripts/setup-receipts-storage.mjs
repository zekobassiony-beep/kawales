// ينشئ Bucket التخزين العام `receipts` (public access) لرفع صور الإيصالات،
// مع ضبطه عامًا وحدّ الحجم 5MB والسماح بصور الإيصالات فقط.
//
//   node scripts/setup-receipts-storage.mjs
//
// الرفع نفسه يتم من السيرفر بمفتاح service_role (يتجاوز RLS)، والقراءة العامة
// متاحة تلقائيًا لأن الـ Bucket عام — لذا لا حاجة لأي سياسة RLS إضافية.
import { readFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const projectRoot = path.resolve(import.meta.dirname, "..")
const BUCKET = "receipts"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(BUCKET)
  const exists = Boolean(data && (data.id === BUCKET || data.name === BUCKET))

  if (exists) {
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ["image/*"],
    })
    if (updateError) throw updateError
    return "updated"
  }

  // غير موجود (خطأ "not found" متوقع) — أنشئه عامًا.
  if (error && !/not found|not found|does not exist/i.test(error.message)) {
    console.warn(`تنبيه أثناء قراءة الـ Bucket (سنتابع الإنشاء): ${error.message}`)
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ["image/*"],
  })
  if (createError) throw createError
  return "created"
}

try {
  const action = await ensureBucket()
  console.log(`Bucket \`${BUCKET}\` ${action === "created" ? "أُنشئ" : "تم ضبطه"} كـ public ✓`)

  const { data: buckets } = await supabase.storage.listBuckets()
  const target = (buckets ?? []).find((bucket) => bucket.id === BUCKET || bucket.name === BUCKET)
  if (target) {
    console.log(`✓ جاهز: ${target.name} (public=${target.public})`)
  } else {
    console.log("✓ الـ Bucket جاهز (لم يظهر في القائمة بعد — لا مشكلة).")
  }
} catch (error) {
  console.error(`تعذّر تجهيز الـ Bucket: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
