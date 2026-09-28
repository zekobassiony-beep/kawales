// ينشئ Buckets التخزين العامة اللازمة للمنصة على Supabase Storage:
//   - `receipts` : صور إيصالات الدفع (Base64 → publicUrl في receipt_url).
//   - `tickets`  : صور التذاكر/QR التي يولّدها بوت تليجرام (ticket_image_url).
//
//   node scripts/setup-storage-buckets.mjs
//
// الرفع يتم من السيرفر بمفتاح service_role (يتجاوز RLS)، والقراءة العامة متاحة
// تلقائيًا لأن الـ Buckets عامة — لذا لا حاجة لأي سياسة RLS إضافية.
import { readFileSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const projectRoot = path.resolve(import.meta.dirname, "..")
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/** الـ Buckets المطلوبة مع أنواع الملفات المسموح بها. */
const BUCKETS = [
  { id: "receipts", label: "إيصالات الدفع", allowedMimeTypes: ["image/*"] },
  { id: "tickets", label: "صور التذاكر/QR", allowedMimeTypes: ["image/png", "image/jpeg", "image/*"] },
]

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

/** يضمن وجود الـ Bucket عامًا مع حد الحجم والأنواع المسموح بها. */
async function ensureBucket(bucket) {
  const { data, error } = await supabase.storage.getBucket(bucket.id)
  const exists = Boolean(data && (data.id === bucket.id || data.name === bucket.id))

  if (exists) {
    const { error: updateError } = await supabase.storage.updateBucket(bucket.id, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: bucket.allowedMimeTypes,
    })
    if (updateError) throw updateError
    return "updated"
  }

  if (error && !/not found|does not exist/i.test(error.message)) {
    console.warn(`تنبيه أثناء قراءة الـ Bucket \`${bucket.id}\` (سنتابع الإنشاء): ${error.message}`)
  }

  const { error: createError } = await supabase.storage.createBucket(bucket.id, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: bucket.allowedMimeTypes,
  })
  if (createError) throw createError
  return "created"
}

try {
  for (const bucket of BUCKETS) {
    const action = await ensureBucket(bucket)
    console.log(`Bucket \`${bucket.id}\` (${bucket.label}) ${action === "created" ? "أُنشئ" : "تم ضبطه"} كـ public ✓`)
  }

  const { data: buckets } = await supabase.storage.listBuckets()
  for (const bucket of BUCKETS) {
    const target = (buckets ?? []).find((item) => item.id === bucket.id || item.name === bucket.id)
    console.log(target ? `✓ جاهز: ${target.name} (public=${target.public})` : `⚠️ لم يظهر \`${bucket.id}\` في القائمة بعد.`)
  }
} catch (error) {
  console.error(`تعذّر تجهيز الـ Buckets: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
