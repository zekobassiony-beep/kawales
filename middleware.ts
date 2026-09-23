import { NextResponse, type NextRequest } from "next/server"
import {
  ADMIN_USERS_TABLE,
  MASTER_ADMIN_EMAIL,
  SESSION_EMAIL_COOKIE,
  isAdminPath,
  normalizeAdminEmail,
} from "@/lib/auth-constants"

/**
 * حماية مسارات الأدمن (`/admin` و `/dashboard/admin`):
 *
 *  1) بلا جلسة (لا كوكي بريد) ⇒ إعادة توجيه إلى `/login?next=...`.
 *  2) البريد الأساسي (`MASTER_ADMIN_EMAIL`) ⇒ دخول فوري.
 *  3) غيره ⇒ فحص جدول `admin_users` على Supabase عبر REST (مفتاح anon العام):
 *     - موجود ⇒ دخول.
 *     - غير موجود ⇒ إعادة توجيه إلى `/login?denied=1`.
 *
 * ملاحظة: صفحة لوحة الأدمن تتحقق أيضًا من الصلاحية على السيرفر بمفتاح الخدمة
 * (طبقة ثانية)، وتُظهر شاشة «403 غير مصرح بالدخول» عند الحاجة.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!isAdminPath(pathname)) return NextResponse.next()

  const email = normalizeAdminEmail(req.cookies.get(SESSION_EMAIL_COOKIE)?.value)

  // (1) لا جلسة: لا نعرف من الزائر ⇒ صفحة الدخول مع العودة للمسار المطلوب.
  if (!email) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  // (2) السوبر أدمن الأساسي: دخول فوري.
  if (email === MASTER_ADMIN_EMAIL) return NextResponse.next()

  // (3) بقية الأدمنز: من جدول admin_users على Supabase.
  if (await isEmailInAdminTable(email)) return NextResponse.next()

  const deniedUrl = req.nextUrl.clone()
  deniedUrl.pathname = "/login"
  deniedUrl.search = "?denied=1"
  return NextResponse.redirect(deniedUrl)
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/dashboard/admin", "/dashboard/admin/:path*"],
}
