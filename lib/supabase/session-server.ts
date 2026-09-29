import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * جلسة Supabase Auth الرسمية على السيرفر — القراءة الوحيدة المعتبرة للمستخدم
 * الحالي (`getUser()` من كوكيز الطلب)، بدلًا من أي كوكي بريد مكتوب من المتصفح.
 *
 * ملف سيرفر فقط (يستعمل `next/headers`)، ولا يعتمد على `@/lib/auth` إطلاقًا
 * حتى لا تحدث حلقة استيراد (auth يستعمل هذه الطبقة للتحقق من الصلاحيات).
 */

/** عميل Supabase للسيرفر مبني على كوكيز الطلب (Server Components / Route Handlers / Actions). */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // يُستدعى من Server Component (بلا استجابة قابلة للكتابة) — يتولّى
            // الوسيط `middleware.ts` تحديث الكوكيز في هذه الحالة.
          }
        }
      },
    },
  })
}

/** المستخدم الحالي من جلسة Supabase الرسمية (أو null عند غياب/انتهاء الجلسة). */
export async function getSupabaseUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ?? null
}

/** بريد جلسة Supabase (مطبَّع) أو سلسلة فارغة. */
export async function getSupabaseUserEmail(): Promise<string> {
  const user = await getSupabaseUser()
  return (user?.email ?? "").trim().toLowerCase()
}

/** مزوّد الدخول الفعلي للحساب (google لغير ذلك password) — من بيانات Supabase. */
export function providerFromSupabaseUser(user: User | null): "google" | "password" {
  const provider = (user?.app_metadata ?? {})["provider"]
  return provider === "google" ? "google" : "password"
}

/** الاسم المعروض من بيانات Supabase (metadata) أو بادئة البريد. */
export function displayNameFromSupabaseUser(user: User | null): string {
  if (!user) return ""
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const candidate = [metadata.full_name, metadata.name, metadata.user_name, user.email?.split("@")[0]]
  const found = candidate.find((value) => typeof value === "string" && value.trim().length > 0)
  return typeof found === "string" ? found : ""
}

/** صورة الحساب من بيانات Supabase (إن وُجدت). */
export function avatarFromSupabaseUser(user: User | null): string {
  if (!user) return ""
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const candidate = [metadata.avatar_url, metadata.picture]
  const found = candidate.find((value) => typeof value === "string" && value.trim().length > 0)
  return typeof found === "string" ? found : ""
}
