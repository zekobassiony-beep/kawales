import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { isAdminEmail } from "@/lib/auth"

/**
 * جلسة Supabase Auth على السيرفر — القراءة الرسمية للمستخدم الحالي
 * (`getUser()`) من كوكيز الطلب بدلًا من الكوكي التخيلي.
 *
 * ملف سيرفر فقط (يستعمل `next/headers`).
 */

/** عميل Supabase للسيرفر مبني على كوكيز الطلب (Server Components / Route Handlers). */
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
