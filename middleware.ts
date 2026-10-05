import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  ADMIN_USERS_TABLE,
  isAdminPath,
  isMasterAdminEmail,
  normalizeAdminEmail,
} from "@/lib/auth-constants"
import { HQ_PATH, isSuperadmin } from "@/lib/roles"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { isE2ETestEmail } from "@/lib/e2e-auth"

/**
 * حماية مسارات الأدمن (`/admin` و `/dashboard/admin`) مع **جلسة Supabase Auth الرسمية**:
 *
 *  1) يقرأ المستخدم الحالي بـ `supabase.auth.getUser()` (كوكيز Supabase) — دون كوكيز تخيّلية.
 *  2) لا مستخدم ⇒ إعادة توجيه إلى `/login?next=...`.
 *  3) البريد الأساسي ⇒ دخول فوري.
 *  4) غيره ⇒ فحص جدول `admin_users` (بمفتاح anon) ⇒ دخول أو `/login?denied=1`.
 *  5) `/hq-kawalees` (غرفة العمليات) ⇒ بريدات السوبر أدمن فقط.
 *
 * ⚠️ أمنيًا: لم يبقَ أي اعتماد على كوكي بريد يكتبه المتصفح (`kawalees:email`)؛
 * كان أي زائر يكتبه ببريد السوبر أدمن فيدخل اللوحة بلا كلمة مرور.
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

  const pathname = req.nextUrl.pathname
  const isHq = pathname === HQ_PATH || pathname.startsWith(`${HQ_PATH}/`)

  // حماية مسارات الأدمن وغرفة العمليات (بقية المسارات تمرّ مع تحديث الجلسة).
  if (!isAdminPath(pathname) && !isHq) return response

  // (2) الجلسة الرسمية فقط — لا كوكي بريد مكتوب من المتصفح (أُزيل مسار الانتحال).
  //     لا مستخدم ⇒ صفحة الدخول مع العودة للمسار المطلوب.
  const email = sessionEmail
  if (!email) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`
    return redirectKeepingSession(loginUrl, response)
  }

  // وضع اختبار E2E: الحساب التجريبي (بعد فتح جلسة Supabase حقيقية من
  // /api/e2e/auth) يمرّ من بوابة الأدمن، فلا تُرفض تدفقات المنتج/البوابة/الأدمن
  // في الاختبارات الآلية. لا أثر لهذا في الإنتاج: الوضع معطّل افتراضيًا ويشترط
  // علامة بيئة + سرًّا (انظر lib/e2e-auth.ts).
  if (isE2ETestEmail(email)) return response

  // (3) غرفة عمليات كواليس: بريدات السوبر أدمن فقط (لا يكفي كونك أدمن لوحة).
  if (isHq) {
    if (isSuperadmin(email) || isMasterAdminEmail(email)) return response
    const deniedHq = req.nextUrl.clone()
    deniedHq.pathname = "/login"
    deniedHq.search = "?denied=1"
    return redirectKeepingSession(deniedHq, response)
  }

  // (4) السوبر أدمن الأساسي: دخول فوري.
  if (isMasterAdminEmail(email)) return response

  // (5) بقية الأدمنز: من جدول admin_users على Supabase.
  if (await isEmailInAdminTable(email)) return response

  const deniedUrl = req.nextUrl.clone()
  deniedUrl.pathname = "/login"
  deniedUrl.search = "?denied=1"
  return redirectKeepingSession(deniedUrl, response)
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard/admin",
    "/dashboard/admin/:path*",
    // غرفة عمليات كواليس (السوبر أدمن فقط) — حماية على السيرفر لا على المتصفح.
    "/hq-kawalees",
    "/hq-kawalees/:path*",
    // اختصارات لوحات التشغيل (مخرج العروض وبوابة المسرح) — محميّة بنفس بوابة الأدمن.
    "/producer",
    "/producer/:path*",
    "/gatekeeper",
    "/gatekeeper/:path*",
  ],
}

