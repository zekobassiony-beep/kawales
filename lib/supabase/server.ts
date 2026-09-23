import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/config"

/**
 * عميل Supabase للسيرفر (Server Routes / Server Actions) بمفتاح `service_role` —
 * يستطيع القراءة والكتابة في جداول المنصة بلا قيود RLS.
 *
 * يستخدم في: ويب هوك التليجرام، إجراءات التذاكر، وقراءة الحجوزات حيًا.
 */
let cachedAdmin: SupabaseClient | null | undefined

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin
  if (!isSupabaseAdminConfigured()) {
    cachedAdmin = null
    return null
  }
  cachedAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdmin
}

/** عميل anon (للقراءة العامة من السيرفر عند عدم الحاجة لصلاحيات الخدمة). */
export function getSupabaseServer(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * يتحقق سريعًا من أن اتصال Supabase يعمل وأن جدول `tickets` موجود —
 * يُستخدم كإشارة للـ fallback في بيئات بدون قاعدة بيانات.
 */
export async function ticketsTableReady(): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false
  const { error } = await admin.from("tickets").select("id", { count: "exact", head: true }).limit(1)
  return !error
}
