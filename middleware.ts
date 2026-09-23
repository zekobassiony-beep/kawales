import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  ADMIN_USERS_TABLE,
  MASTER_ADMIN_EMAIL,
  SESSION_EMAIL_COOKIE,
  isAdminPath,
  normalizeAdminEmail,
} from "@/lib/auth-constants"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * حماية مسارات الأدمن (`/admin` و `/dashboard/admin`) مع **جلسة Supabase Auth الرسمية**:
 *
 *  1) يقرأ المستخدم الحالي بـ `supabase.auth.getUser()` (كوكيز Supabase) — دون كوكيز تخيّلية.
 *  2) لا مستخدم ⇒ إعادة توجيه إلى `/login?next=...`.
 *  3) البريد الأساسي ⇒ دخول فوري.
 *  4) غيره ⇒ فحص جدول `admin_users` (بمفتاح anon) ⇒ دخول أو `/login?denied=1`.
 *  5) لا يزال يدعم كوكي الجلسة المحلية كـ **fallback** للجلسة التجريبية السابقة.
 */

const supabaseReady = isSupabaseConfigured()

/** فحص وجود البريد في جدول admin_users (يعيد false عند أي فشل/غياب الجدول). */
async function isEmailInAdminTable(email: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try {
    const url = `${SUPABASE_URL}/rest/v1/${ADMIN_USERS_TABLE}?select=email&email=eq.${encodeURIComponent(email)}&limit=1`
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
    })
    if (!response.ok) return false
    const rows = (await response.json()) as unknown
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** يُنشئ إعادة توجيه مع نقل كوكيز جلسة Supabase المُحدَّثة (refresh). */
function redirectKeepingSession(url: URL, carried: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of carried.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export async function middleware(req: NextRequest) {
  // (1) تحديث جلسة Supabase وقراءة المستخدم الرسمي (نمط Supabase لـ Next.js).
  let response = NextResponse.next({ request: req })
  let sessionEmail = ""

  if (supabaseReady) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) req.cookies.set(name, value)
          response = NextResponse.next({ request: req })
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    })
    const { data } = await supabase.auth.getUser()
    sessionEmail = normalizeAdminEmail(data.user?.email)
  }

  // حماية مسارات الأدمن فقط (بقية المسارات تمرّ مع تحديث الجلسة).
  if (!isAdminPath(req.nextUrl.pathname)) return response

  // fallback: كوكي الجلسة المحلية (التجريبية) عند غياب جلسة Supabase.
  const legacyEmail = normalizeAdminEmail(req.cookies.get(SESSION_EMAIL_COOKIE)?.value)
  const email = sessionEmail || legacyEmail

  // (2) لا جلسة معروفة ⇒ صفحة الدخول مع العودة للمسار المطلوب.
  if (!email) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`
    return redirectKeepingSession(loginUrl, response)
  }

  // (3) السوبر أدمن الأساسي: دخول فوري.
  if (email === MASTER_ADMIN_EMAIL) return response

  // (4) بقية الأدمنز: من جدول admin_users على Supabase.
  if (await isEmailInAdminTable(email)) return response

  const deniedUrl = req.nextUrl.clone()
  deniedUrl.pathname = "/login"
  deniedUrl.search = "?denied=1"
  return redirectKeepingSession(deniedUrl, response)
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/dashboard/admin", "/dashboard/admin/:path*"],
}

