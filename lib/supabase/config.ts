/**
 * إعدادات Supabase المركزية — تُقرأ من متغيّرات البيئة.
 *
 * - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: آمنة للمتصفح.
 * - `SUPABASE_SERVICE_ROLE_KEY`: للسيرفر فقط (لا تُمرَّر للمتصفح أبدًا).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

/** اسم جدول التذاكر على Supabase (Postgres). */
export const TICKETS_TABLE = "tickets"

/** هل بيانات الاتصال العامة (URL + anon) مهيأة؟ */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
}

/** هل مفتاح الخدمة (service role) مهيأ للكتابة من السيرفر؟ */
export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && SUPABASE_SERVICE_ROLE_KEY.length > 0
}
