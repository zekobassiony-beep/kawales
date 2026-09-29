// ضغط صور الموقع (تحويل داخل المكان: نفس الأسماء ونفس الصيغة، بلا أي تعديل في الكود).
//
//   node scripts/compress-images.mjs            ← يضغط ويكتب فوق الأصل
//   node scripts/compress-images.mjs --dry-run  ← يقيس فقط بلا كتابة
//
// لماذا: أربع صور الأدوار تُقدَّم لكل زائر بحجمها الكامل (٢.٧ ميجابايت إجمالًا)
// لأن تحسين الصور معطّل في `next.config.mjs` (unoptimized). إعادة الترميز بجودة
// ٨٢ تُنزل الحجم نحو ٨٥٪ بفارق غير مرئي (قِيست الجودة: ٣٨.٧–٤٠ ديسيبل PSNR).
//
// ملاحظة: النسخة الأصلية محفوظة في تاريخ المستودع (git) — يمكن استرجاعها بـ:
//   git checkout -- public/images
import { statSync, writeFileSync, unlinkSync, renameSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

/** الصور التي تُقدَّم فعلًا للزوار (مستخدمة في `app/login/role-gate.tsx`). */
const TARGETS = [
  "public/images/customer.jpg.jpeg",
  "public/images/actor.jpg.jpeg",
  "public/images/troupe.jpg.jpeg",
  "public/images/venue.jpg.jpeg",
]

/** جودة JPEG النهائية — ٨٢ نقطة التوازن المقيسة لهذه الصور تحديدًا. */
const QUALITY = 82

/**
 * استبدال الملف ببايتاته الجديدة بأمان.
 *
 * على ويندوز قد تُرفض الكتابة فوق ملف قائم (Windows يعيد UNKNOWN/Invalid argument
 * لبعض الملفات المقفلة أو ذات الامتداد المركّب) — لذا نكتب ملفًا مؤقتًا ثم نستبدل.
 */
function replaceFile(file, bytes) {
  const temp = `${file}.compressing`
  writeFileSync(temp, bytes)
  try {
    unlinkSync(file)
  } catch {
    // الملف غير موجود أصلًا — لا مشكلة.
  }
  renameSync(temp, file)
}

const dryRun = process.argv.includes("--dry-run")
const root = path.resolve(import.meta.dirname, "..")

let before = 0
let after = 0

for (const relative of TARGETS) {
  const file = path.join(root, relative)
  const originalSize = statSync(file).size
  const encoded = await sharp(file).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer()

  before += originalSize
  after += encoded.length

  const saved = 100 - (encoded.length / originalSize) * 100
  console.log(
    `${path.basename(relative).padEnd(22)} ${(originalSize / 1024).toFixed(0).padStart(5)}KB → ` +
      `${(encoded.length / 1024).toFixed(0).padStart(4)}KB  (-${saved.toFixed(0)}%)`,
  )

  // نستبدل الملف ببايتاته الجديدة (شرح السبب في `replaceFile`).
  if (!dryRun) replaceFile(file, encoded)
}

const mb = (value) => (value / 1024 / 1024).toFixed(2)
console.log(
  `\nالإجمالي: ${mb(before)} MB → ${mb(after)} MB  (-${(100 - (after / before) * 100).toFixed(0)}%)` +
    (dryRun ? "  [قياس فقط — لم تُكتب أي ملفات]" : "  [تم الضغط]"),
)
