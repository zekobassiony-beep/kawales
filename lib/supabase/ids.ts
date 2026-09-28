import { createHash } from "node:crypto"

/**
 * معرّفات المستخدمين لجدول `tickets` في Supabase.
 *
 * عمود `user_id` في قاعدة البيانات الفعلية نوعه **`uuid`**، بينما المنصة تعرّف
 * العميل ببريده الإلكتروني — وكتابة بريد في عمود uuid ترمي:
 *   `22P02 invalid input syntax for type uuid`
 * وهو سبب فشل حفظ التذاكر سابقًا (مع بقاء إشعار تليجرام يعمل).
 *
 * الحل هنا بلا أي ترحيل: نشتق **UUIDv5 ثابتًا** من البريد (نفس البريد ⇒ نفس المعرّف
 * دائمًا)، فيصبح `user_id` صالحًا وقابلًا للاستعلام كما كان.
 *
 * ملف سيرفر فقط (يعتمد على `node:crypto`).
 */

/** صيغة UUID القياسية (v1–v5). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** فضاء الأسماء القياسي لـ UUIDv5 (DNS namespace, RFC 4122). */
const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

/** هل القيمة UUID صالح؟ */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

/**
 * يحوّل بريد العميل (أو أي معرّف نصي) إلى معرّف صالح لعمود `uuid`:
 * - معرّف uuid فعلي (من Supabase Auth) ⇒ يُعاد كما هو.
 * - بريد/نص آخر ⇒ UUIDv5 ثابت ومشتق (نفس المدخل يعطي نفس الناتج دائمًا).
 * - قيمة فارغة ⇒ `null`.
 */
export function emailToUserId(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase()
  if (value.length === 0) return null
  if (UUID_PATTERN.test(value)) return value

  const namespace = Buffer.from(NAMESPACE_DNS.replace(/-/g, ""), "hex")
  const digest = createHash("sha1").update(Buffer.concat([namespace, Buffer.from(value, "utf8")])).digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // الإصدار 5 (SHA-1)
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // النوع RFC 4122

  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
