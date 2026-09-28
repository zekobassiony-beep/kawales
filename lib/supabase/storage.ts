import { randomUUID } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { withTimeout } from "@/lib/with-timeout"

/**
 * تخزين إيصالات الدفع على Supabase Storage.
 *
 * الإيصالات تُرفع إلى Bucket عام اسمه `receipts` (public access)، ويُحفظ
 * الرابط العام `publicUrl` في عمود `receipt_url` بجدول `tickets` بدلًا من
 * تخزين الصورة كـ Base64 داخل قاعدة البيانات.
 *
 * ملاحظة: الرفع يتم من السيرفر بمفتاح `service_role` (يتجاوز سياسات RLS)،
 * والقراءة العامة متاحة تلقائيًا لأن الـ Bucket عام — لذا لا حاجة لأي
 * سياسة RLS إضافية على `storage.objects` للقراءة أو للرفع من السيرفر.
 *
 * هذا الملف سيرفر فقط (يستعمل `Buffer` و`node:crypto`).
 */

/** اسم الـ Bucket العام لإيصالات الدفع. */
export const RECEIPTS_BUCKET = "receipts"

/**
 * اسم الـ Bucket العام لصور التذاكر/QR التي يولّدها بوت تليجرام ويخزّنها
 * ليعرضها الموقع (الموقع «معرض/عرض» فقط لهذه الصورة).
 */
export const TICKETS_BUCKET = "tickets"

/** الحد الأقصى لحجم صورة الإيصال (5 ميجابايت). */
export const RECEIPTS_MAX_SIZE_BYTES = 5 * 1024 * 1024

/** مهلة عمليات التخزين (رفع/قراءة) — تمنع تعليق الحجز على Storage بطيء. */
const STORAGE_TIMEOUT_MS = 12_000

export type UploadReceiptInput = {
  /** data URL كاملة (data:image/...;base64,...) أو Base64 خام. */
  data: string
  /** معرّف التذكرة — يُستخدم ضمن اسم الملف لسهولة التتبّع (اختياري). */
  ticketId?: string
}

export type UploadReceiptResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; error: string }

/** يرجع امتداد الملف المناسب لنوع MIME معروف، أو `bin`. */
function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/pdf": "pdf",
  }
  const normalized = mimeType.toLowerCase().split(";")[0].trim()
  return map[normalized] ?? "bin"
}

/** يفكّ data URL أو Base64 خام إلى بايتات + نوع MIME، أو null عند التعذّر. */
function decodeImage(data: string): { bytes: Uint8Array; mimeType: string } | null {
  const trimmed = data.trim()
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(trimmed)
  if (match) {
    const mimeType = (match[1] || "image/jpeg").toLowerCase()
    const payload = match[3] ?? ""
    if (match[2] === ";base64") {
      const bytes = Uint8Array.from(Buffer.from(payload, "base64"))
      if (bytes.length === 0) return null
      return { bytes, mimeType }
    }
    try {
      return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType }
    } catch {
      return null
    }
  }
  // افتراض Base64 خام.
  const bytes = Uint8Array.from(Buffer.from(trimmed, "base64"))
  if (bytes.length === 0) return null
  return { bytes, mimeType: "image/jpeg" }
}

/** يبني مسارًا فريدًا وآمنًا للملف داخل الـ Bucket. */
function buildPath(ticketId: string | undefined, extension: string): string {
  const safe = (ticketId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)
  const stamp = Date.now()
  const rand = randomUUID().slice(0, 8)
  const name = safe ? `${safe}-${stamp}-${rand}` : `${stamp}-${rand}`
  return `${name}.${extension}`
}

/**
 * يرفع صورة إيصال إلى Bucket `receipts` على Supabase Storage ويعيد رابطها
 * العام (`publicUrl`) للحفظ في عمود `receipt_url`.
 */
export async function uploadReceiptToStorage(input: UploadReceiptInput): Promise<UploadReceiptResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }

  const decoded = decodeImage(input.data)
  if (!decoded) return { ok: false, error: "تعذّر قراءة صورة الإيصال." }

  if (decoded.bytes.length > RECEIPTS_MAX_SIZE_BYTES) {
    return { ok: false, error: "حجم صورة الإيصال يتجاوز الحد الأقصى (5 ميجابايت)." }
  }

  const extension = extensionForMime(decoded.mimeType)
  const path = buildPath(input.ticketId, extension)

  try {
    // رفع بمهلة قصوى: التخزين البطيء لا يجوز أن يُعلّق تأكيد الحجز.
    let uploadError: string | null = null
    try {
      const { error } = await withTimeout(
        admin.storage.from(RECEIPTS_BUCKET).upload(path, decoded.bytes, {
          contentType: decoded.mimeType,
          cacheControl: "3600",
          upsert: false,
        }),
        STORAGE_TIMEOUT_MS,
        "storage.uploadReceipt",
      )
      uploadError = error ? error.message : null
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error)
    }
    if (uploadError) return { ok: false, error: uploadError }

    const { data } = admin.storage.from(RECEIPTS_BUCKET).getPublicUrl(path)
    return { ok: true, publicUrl: data.publicUrl, path }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * يرفع صورة التذكرة/QR (PNG يولّده بوت تليجرام على السيرفر) إلى Bucket `tickets`
 * ويعيد رابطها العام — وهو الرابط الذي يُحفظ في `ticket_image_url` ويعرضه الموقع.
 */
export async function uploadTicketImageToStorage(
  ticketId: string,
  png: Uint8Array,
): Promise<{ ok: true; publicUrl: string; path: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }

  const safe = ticketId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "ticket"
  const path = `${safe}-${Date.now()}.png`

  try {
    let uploadError: string | null = null
    try {
      const { error } = await withTimeout(
        admin.storage.from(TICKETS_BUCKET).upload(path, png, {
          contentType: "image/png",
          cacheControl: "3600",
          upsert: true,
        }),
        STORAGE_TIMEOUT_MS,
        "storage.uploadTicketImage",
      )
      uploadError = error ? error.message : null
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error)
    }
    if (uploadError) return { ok: false, error: uploadError }

    const { data } = admin.storage.from(TICKETS_BUCKET).getPublicUrl(path)
    return { ok: true, publicUrl: data.publicUrl, path }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** هل القيمة رابط HTTP(S) جاهز بالفعل؟ */
export function isPublicUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

/**
 * يحوّل قيمة `receiptImage` إلى رابط عام صالح للحفظ في `receipt_url`:
 * - فارغة ⇒ `undefined`.
 * - رابط HTTP(S) ⇒ يُعاد كما هو.
 * - data URL / Base64 ⇒ يُرفع إلى Storage ويُعاد الرابط العام.
 *   عند فشل الرفع نرجع للقيمة الأصلية حتى لا نفقد الإيصال (مع تسجيل تحذير).
 */
export async function resolveReceiptPublicUrl(
  value: string | undefined,
  ticketId: string,
): Promise<string | undefined> {
  if (!value || value.trim().length === 0) return undefined
  if (isPublicUrl(value)) return value
  const result = await uploadReceiptToStorage({ data: value, ticketId })
  if (result.ok) return result.publicUrl
  console.warn(`[supabase] receipt upload failed (fallback to original): ${result.error}`)
  return value
}
