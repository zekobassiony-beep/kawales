import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { resolvePostLoginPath } from "@/lib/supabase/auth-server"
import { ROLE_DASHBOARD_PATH, isAccountRole } from "@/lib/roles"
import { normalizeAdminEmail } from "@/lib/auth-constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * مسار العودة من Supabase Auth (`/auth/callback`):
 *  - يستبدل `code` بجلسة حقيقية ويحفظ الكوكيز.
 *  - الأدمن ⇒ `/dashboard/admin` · غيره ⇒ `next` أو `/dashboard/customer`.
 *
 * يُستعمل مع Google OAuth ومع الرابط السحري (Magic Link) من Email OTP.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? ""
  const errorDescription = searchParams.get("error_description")

  // يُحسب الأصل بأمان خلف وكيل Vercel (x-forwarded-*) مع دعم التطوير المحلي (http).
  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto = req.headers.get("x-forwarded-proto")
  const host = forwardedHost ?? req.headers.get("host") ?? req.nextUrl.host
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https")
  const baseUrl = host ? `${protocol}://${host}` : origin
  const failureUrl = new URL("/login?error=auth", baseUrl)

  if (errorDescription) return NextResponse.redirect(failureUrl)
  if (!code) return NextResponse.redirect(failureUrl)
  if (!isSupabaseConfigured()) return NextResponse.redirect(failureUrl)

  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // لا يمكن الكتابة من هذا السياق — نتجاهل بأمان.
          }
        }
      },
    },
  })

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.warn(`[auth] exchangeCodeForSession failed: ${error?.message ?? "no user"}`)
    return NextResponse.redirect(failureUrl)
  }

  const email = normalizeAdminEmail(data.user.email)

  // من أكمل بياناته سابقًا ⇒ لوحته مباشرة بلا المرور على /onboarding (كانت المشكلة
  // بعد تسجيل الخروج ثم الدخول: الجلسة المحلية تُمسح، والحفظ في الداتا هو الدليل).
  const savedDashboard = await dashboardForOnboardedUser(data.user.id)

  // الأدمن تبقى له الأولوية (resolvePostLoginPath يفحص admin_users أولًا).
  const target = await resolvePostLoginPath(email, savedDashboard ?? next)

  // جلسة Supabase نفسها هي ما يحمي المسارات (كوكيز مُوقَّعة يقرأها الوسيط)،
  // فلا نكتب أي كوكي بريد من هنا — كان ذلك يسمح بانتحال بريد الأدمن.
  return NextResponse.redirect(new URL(target, baseUrl))
}

/** مسار اللوحة المناسب لمستخدم أكمل بياناته (أو null لمن لم يكملها بعد). */
async function dashboardForOnboardedUser(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from("profiles")
    .select("role, onboarded")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data || data.onboarded !== true) return null
  return isAccountRole(data.role) ? ROLE_DASHBOARD_PATH[data.role] : null
}
