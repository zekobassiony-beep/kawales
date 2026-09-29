import { isAdminEmail } from "@/lib/auth"

/**
 * قراءة جلسة Supabase الرسمية وبيانات المستخدم صارت في
 * `@/lib/supabase/session-server` (مفصولة عن `@/lib/auth` لمنع حلقة الاستيراد)
 * ويُعاد تصديرها من هنا للتوافق مع بقية الملفات.
 */
export {
  createSupabaseServerClient,
  getSupabaseUser,
  getSupabaseUserEmail,
  providerFromSupabaseUser,
  displayNameFromSupabaseUser,
  avatarFromSupabaseUser,
} from "@/lib/supabase/session-server"

/**
 * جلسة Supabase Auth على السيرفر — القراءة الرسمية للمستخدم الحالي
 * (`getUser()`) من كوكيز الطلب بدلًا من الكوكي التخيلي.
 *
 * ملف سيرفر فقط (يستعمل `next/headers`).
 */

/**
 * الوجهة بعد تسجيل الدخول:
 *  - الأدمن (`isMasterAdminEmail` أو موجود في `admin_users`) ⇒ `/dashboard/admin`.
 *  - وإلا ⇒ `next` المطلوب إن وُجد، وإلا `/dashboard/customer`.
 */
export async function resolvePostLoginPath(email: string | null | undefined, next?: string): Promise<string> {
  const normalized = (email ?? "").trim().toLowerCase()
  if (normalized && (await isAdminEmail(normalized))) return "/dashboard/admin"
  const requested = (next ?? "").trim()
  if (requested.startsWith("/") && !requested.startsWith("//")) return requested
  return "/dashboard/customer"
}
