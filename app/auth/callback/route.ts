import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { resolvePostLoginPath } from "@/lib/supabase/auth-server"
import { SESSION_EMAIL_COOKIE, normalizeAdminEmail } from "@/lib/auth-constants"

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
  const target = await resolvePostLoginPath(email, next)
  const response = NextResponse.redirect(new URL(target, baseUrl))

  // انعكاس بريد الجلسة في كوكي الوسيط (ليزامن حماية مسارات الأدمن فورًا).
  if (email) {
    response.cookies.set(SESSION_EMAIL_COOKIE, email, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    })
  }

  return response
}
