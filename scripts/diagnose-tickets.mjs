// يشخّص فشل حفظ التذاكر في Supabase بنفس مسار التطبيق (REST API + service_role):
//   1) هل متغيّرات البيئة موجودة (بأطوالها فقط — بلا كشف أي قيمة)؟
//   2) هل العميل admin (service_role) جاهز أصلًا؟
//   3) ما الأعمدة الفعلية الموجودة في جدول `tickets`؟
//   4) هل الأعمدة التي يكتبها `ticketToRow` موجودة كلها؟
//   5) اختبار كتابة/حذف حقيقي (Round-trip) مع طباعة error.code/details/hint بدقة.
//
//   node scripts/diagnose-tickets.mjs
//   node scripts/diagnose-tickets.mjs --keep      (لا يحذف صف الاختبار)
import { createClient } from "@supabase/supabase-js"
import { loadEnvLocal } from "../tests/load-env.mjs"

const env = loadEnvLocal()
const pick = (key) => process.env[key] || env[key] || ""

const url = pick("NEXT_PUBLIC_SUPABASE_URL")
const serviceKey = pick("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY")

/** الأعمدة التي يكتبها `ticketToRow` في lib/supabase/tickets.ts (إلزامية للحفظ). */
const REQUIRED_COLUMNS = [
  "id",
  "show_id",
  "user_id",
  "sender_phone",
  "receipt_url",
  "status",
  "total_price",
  "seats",
  "created_at",
]

/** أعمدة اختيارية (ميزات تليجرام) — يتحمّلها التطبيق لو غابت. */
const OPTIONAL_COLUMNS = ["telegram_chat_id", "ticket_image_url"]

const TEST_ID = "KW-ZZDIAG9"
const keep = process.argv.includes("--keep")

function line(title) {
  console.log(`\n=== ${title} ===`)
}

line("١) متغيّرات البيئة")
console.log(`NEXT_PUBLIC_SUPABASE_URL      : ${url ? `موجود (${url.length} حرفًا)` : "✗ مفقود"}`)
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY : ${anonKey ? `موجود (${anonKey.length} حرفًا)` : "✗ مفقود"}`)
console.log(`SUPABASE_SERVICE_ROLE_KEY     : ${serviceKey ? `موجود (${serviceKey.length} حرفًا)` : "✗ مفقود"}`)

if (!url || !serviceKey) {
  console.error("\n✗ لا يمكن التشخيص: عميل service_role غير مهيأ — هذا وحده يجعل كل حفظ يفشل بصمت.")
  console.error("  اضبط NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (محليًا في .env.local، وعلى Vercel في Environment Variables).")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = anonKey ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null

/** يطبع خطأ PostgREST كاملًا (رسالة/كود/تفاصيل/تلميح) — هو مفتاح التشخيص. */
function printError(prefix, error) {
  if (!error) return
  console.error(`${prefix}`)
  console.error(`  message : ${error.message ?? "-"}`)
  console.error(`  code    : ${error.code ?? "-"}`)
  console.error(`  details : ${error.details ?? "-"}`)
  console.error(`  hint    : ${error.hint ?? "-"}`)
}

line("٢) الاتصال والوصول للجدول (service_role)")
const head = await admin.from("tickets").select("id", { count: "exact", head: true })
console.log(`select head: ${head.error ? "✗ فشل" : `✓ نجح (عدد الصفوف=${head.count ?? "?"})`}`)
printError("خطأ القراءة:", head.error)

line("٣) الأعمدة الفعلية للجدول")
const sample = await admin.from("tickets").select("*").limit(1)
if (sample.error) {
  printError("✗ تعذّرت قراءة صف للتعرف على الأعمدة:", sample.error)
} else if (!sample.data || sample.data.length === 0) {
  console.log("الجدول فارغ — لا يمكن قراءة الأعمدة من صف (سنفحصها بالأسماء أدناه).")
} else {
  console.log(`الأعمدة الموجودة فعلًا: ${Object.keys(sample.data[0]).sort().join(", ")}`)
}

line("٤) فحص أسماء الأعمدة المطلوبة")
const requiredProbe = await admin.from("tickets").select(REQUIRED_COLUMNS.join(",")).limit(1)
if (requiredProbe.error) {
  printError("✗ أحد الأعمدة المطلوبة غير موجود:", requiredProbe.error)
} else {
  console.log(`✓ كل الأعمدة المطلوبة موجودة: ${REQUIRED_COLUMNS.join(", ")}`)
}

const optionalProbe = await admin.from("tickets").select(OPTIONAL_COLUMNS.join(",")).limit(1)
if (optionalProbe.error) {
  printError("⚠ أعمدة تليجرام الاختيارية ناقصة (يحتاج ترحيل scripts/tickets-telegram.sql):", optionalProbe.error)
} else {
  console.log(`✓ أعمدة تليجرام موجودة: ${OPTIONAL_COLUMNS.join(", ")}`)
}

if (anon) {
  line("٥) اختبار الكتابة بمفتاح anon (يُتوقّع أن تفشل بسبب RLS)")
  const anonWrite = await anon
    .from("tickets")
    .upsert(
      {
        id: `${TEST_ID}A`,
        show_id: "diag",
        user_id: null,
        sender_phone: null,
        receipt_url: null,
        status: "pending",
        total_price: 0,
        seats: [],
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single()
  if (anonWrite.error) printError("نتيجة anon (فشل متوقّع إن كان RLS مفعّلًا):", anonWrite.error)
  else console.log("⚠ مفتاح anon استطاع الكتابة! (RLS غير مفعّل على الكتابة — راجع السياسات)")
}

line("٦) اختبار كتابة/قراءة/حذف فعلي بمفتاح service_role")
const payload = {
  id: TEST_ID,
  show_id: "diag-show",
  user_id: "diag@example.com",
  sender_phone: "01000000000",
  receipt_url: "https://example.test/diag.jpg",
  status: "pending",
  total_price: 1000,
  seats: ["A1"],
  created_at: new Date().toISOString(),
}

const write = await admin.from("tickets").upsert(payload, { onConflict: "id" }).select().single()
if (write.error) {
  printError("✗ فشل الحفظ — هذا هو سبب رسالة الخطأ في الموقع:", write.error)
} else {
  console.log(`✓ نجح الحفظ: ${JSON.stringify(write.data).slice(0, 200)}`)
}

if (!keep) {
  const cleanup = await admin.from("tickets").delete().eq("id", TEST_ID)
  console.log(cleanup.error ? "⚠ تعذّر حذف صف الاختبار — احذفه يدويًا." : "✓ حُذف صف الاختبار.")
} else {
  console.log(`(تم الإبقاء على صف الاختبار ${TEST_ID} بسبب --keep)`)
}

line("٧) اختبار مسار التطبيق الحقيقي (ticketToRow + upsertTicketInDbDetailed)")
// نضبط متغيّرات البيئة قبل تحميل وحدات التطبيق (تقرؤها عند التحميل).
for (const [key, value] of Object.entries(env)) {
  if (!process.env[key]) process.env[key] = value
}

let appUpsert = null
let emailToUserId = null
try {
  const ticketsModule = await import("../lib/supabase/tickets.ts")
  const idsModule = await import("../lib/supabase/ids.ts")
  appUpsert = ticketsModule.upsertTicketInDbDetailed
  emailToUserId = idsModule.emailToUserId
} catch (error) {
  console.warn(`⚠ تعذّر تحميل وحدات التطبيق (شغّل السكربت عبر npm run db:diagnose-tickets): ${error.message}`)
}

if (appUpsert) {
  const fixture = {
    id: TEST_ID,
    showId: "diag-show",
    showTitle: "تشخيص",
    venue: "تشخيص",
    startsAt: new Date().toISOString(),
    customerId: "diag@example.com",
    customerName: "تشخيص",
    seats: ["A1", "A2"],
    tierName: "VIP",
    totalCents: 12345,
    paymentMethod: "vodafone_cash",
    paymentRef: "01000000000",
    status: "pending",
    senderPhone: "01000000000",
    receiptImage: "https://example.test/diag.jpg",
    qrCode: `kawalees:ticket:${TEST_ID}:diag-show`,
    createdAt: new Date().toISOString(),
  }

  const result = await appUpsert(fixture)
  console.log(`النتيجة: ok=${result.ok}${result.ok ? ` degraded=${result.degraded}` : ""}`)
  console.log(`المحاولات: ${result.attempts.join(" | ") || "-"}`)
  if (!result.ok) {
    printError("✗ فشل مسار التطبيق — هذا ما يظهر للمستخدم:", result.error)
  } else {
    console.log(`✓ مسار التطبيق نجح — user_id المستخدم: ${emailToUserId("diag@example.com")}`)
  }

  const cleanup = await admin.from("tickets").delete().eq("id", TEST_ID)
  console.log(cleanup.error ? "⚠ تعذّر حذف صف الاختبار — احذفه يدويًا." : "✓ حُذف صف الاختبار.")
}

line("خلاصة الإصلاح المقترح")
console.log("- code=PGRST204 / 42703  ⇒ عمود غير موجود: طبّق scripts/supabase-schema.sql و scripts/tickets-telegram.sql")
console.log("- message يذكر \"row-level security\" ⇒ المفتاح المستخدم ليس service_role (تحقق من SUPABASE_SERVICE_ROLE_KEY على السيرفر)")
console.log("- invalid input syntax for type ... ⇒ تعارض نوع عمود (مثل created_at أو total_price أو seats)")
console.log("- relation \"public.tickets\" does not exist (42P01) ⇒ الجدول غير موجود في المشروع/المخطط الصحيح")
