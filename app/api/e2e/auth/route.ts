import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { isAccountRole, type AccountRole } from "@/lib/roles"
import {
  E2E_AUTH_TOKEN_HEADER,
  isE2EAccountExistsError,
  normalizeE2EEmail,
  readE2EConfig,
  resolveE2ERedirect,
  resolveE2ERole,
  verifyE2EToken,
} from "@/lib/e2e-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * مسار التوثيق الآلي للاختبارات الشاملة: `/api/e2e/auth`
 *
 * يستقبل طلبًا من مشغّل الاختبار، فيتأكد من وجود الحساب التجريبي (إنشاء بمفتاح
 * الخدمة مع `email_confirm: true` أو تحديث كلمة مروره إن كان موجودًا)، ثم يفتح
 * **جلسة Supabase حقيقية** ويكتب كوكيزها في الاستجابة — تمامًا كما يفعل الدخول من
 * المتصفح. ولهذا يقبلها الوسيط `middleware.ts` وبقيت الصفحات، فتعمل كل التدفقات.
 *
 * الاستخدام (بعد تفعيل الوضع في `.env.local`):
 *   GET  /api/e2e/auth?token=...&role=troupe&next=/dashboard/producer   → 303 + كوكيز
 *   POST /api/e2e/auth  { token, role, next }                            → JSON + كوكيز
 *   GET  /api/e2e/auth?token=...&action=logout                           → إنهاء الجلسة
 *
 * الاستجابة تعيد أيضًا `redirect` حتى يعرف المشغّل إلى أين يتوجّه بعد الدخول.
 */

type CookieToSet = { name: string; value: string; options: CookieOptions }

type SessionResult =
  | { ok: true; cookies: CookieToSet[]; email: string }
  | { ok: false; error: string }

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>

/** يبحث عن مستخدم بالبريد في الصفحات الأولى (نفس أسلوب باقي سكربتات المنصة). */
async function findUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return null
    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? "").trim().toLowerCase() === email)
    if (match) return match
    if (users.length < 200) break
  }
  return null
}

/**
 * يتأكد من وجود الحساب التجريبي بكلمة مرور معروفة وبريد مؤكَّد.
 * لا يمسّ حسابات حقيقية: يعمل بمفتاح الخدمة على مشروع Supabase المُهيَّأ للمنصة.
 */
async function ensureE2EUser(
  admin: AdminClient,
  input: { email: string; password: string; role: AccountRole },
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const metadata = { role: input.role, full_name: `E2E ${input.role}`, kawalees_e2e: true }

  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (!created.error) return { ok: true, created: true }

  const { message, code } = created.error as { message?: string; code?: string }
  if (!isE2EAccountExistsError(message, code)) {
    return { ok: false, error: message ?? "تعذّر إنشاء حساب الاختبار." }
  }

  // الحساب موجود مسبقًا: نضبط كلمة المرور ونؤكّد البريد مع الحفاظ على بقية بياناته.
  const existing = await findUserByEmail(admin, input.email)
  if (!existing) return { ok: false, error: `الحساب ${input.email} موجود لكن تعذّر العثور عليه.` }

  const merged = { ...(existing.user_metadata ?? {}), ...metadata }
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: input.password,
    email_confirm: true,
    user_metadata: merged,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, created: false }
}

/** يفتح جلسة Supabase ويجمع الكوكيز الناتجة دون كتابتها بعد (نضعها على استجابتنا). */
async function openSession(req: NextRequest, email: string, password: string): Promise<SessionResult> {
  const cookies: CookieToSet[] = []
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(list) {
        cookies.length = 0
        cookies.push(...list)
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  if (!data.session) return { ok: false, error: "لم تُفتح الجلسة — أعد المحاولة." }
  return { ok: true, cookies, email }
}

/** إنهاء الجلسة (كوكيز الحذف تأتي من Supabase). */
async function closeSession(req: NextRequest): Promise<CookieToSet[]> {
  const cookies: CookieToSet[] = []
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(list) {
        cookies.length = 0
        cookies.push(...list)
      },
    },
  })
  await supabase.auth.signOut().catch(() => undefined)
  return cookies
}

/** ينسخ كوكيز الجلسة إلى الاستجابة. */
function withCookies(response: NextResponse, cookies: CookieToSet[]): NextResponse {
  for (const { name, value, options } of cookies) response.cookies.set(name, value, options)
  return response
}


/** الأصل العام للطلب (يدعم البروكسي/النفق كما يفعل `/auth/callback`). */
function originOf(req: NextRequest): string {
  const url = new URL(req.url)
  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto = req.headers.get("x-forwarded-proto")
  const host = forwardedHost ?? req.headers.get("host") ?? url.host
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const protocol = forwardedProto ?? (isLocal ? "http" : "https")
  return host ? `${protocol}://${host}` : url.origin
}

type Mode = "get" | "post"

async function handle(req: NextRequest, mode: Mode): Promise<NextResponse> {
  const config = readE2EConfig()

  // الوضع معطّل ⇒ نُخفي المسار تمامًا (404) فلا نكشف وجوده في الإنتاج.
  if (!config.enabled) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  const url = new URL(req.url)
  let body: Record<string, unknown> = {}
  if (mode === "post") {
    try {
      const parsed: unknown = await req.json()
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>
    } catch {
      // جسم غير صالح — نكمل بمعطيات الرابط.
    }
  }

  const pick = (key: string): string => {
    const fromBody = body[key]
    if (typeof fromBody === "string" && fromBody.trim().length > 0) return fromBody.trim()
    return (url.searchParams.get(key) ?? "").trim()
  }

  const token = req.headers.get(E2E_AUTH_TOKEN_HEADER) ?? pick("token")
  if (!verifyE2EToken(token, config.token)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const action = pick("action").toLowerCase()

  // إنهاء الجلسة (تنظيف بعد الاختبار).
  if (action === "logout" || action === "signout") {
    const cleared = await closeSession(req)
    if (mode === "get") {
      return withCookies(NextResponse.redirect(new URL("/login", originOf(req)), 303), cleared)
    }
    return withCookies(NextResponse.json({ ok: true, action: "logout", redirect: "/login" }), cleared)
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 })
  }
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_not_configured" }, { status: 503 })
  }

  const role = resolveE2ERole(pick("role"))
  const email = normalizeE2EEmail(pick("email")) || config.email
  const password = pick("password") || config.password
  const redirect = resolveE2ERedirect(role, pick("next"))

  const ensured = await ensureE2EUser(admin, { email, password, role })
  if (!ensured.ok) {
    console.error(`[e2e-auth] تعذّر تجهيز الحساب ${email}: ${ensured.error}`)
    return NextResponse.json({ ok: false, error: ensured.error }, { status: 500 })
  }

  const session = await openSession(req, email, password)
  if (!session.ok) {
    console.error(`[e2e-auth] تعذّر فتح الجلسة ${email}: ${session.error}`)
    return NextResponse.json({ ok: false, error: session.error }, { status: 401 })
  }

  const payload = { ok: true, email: session.email, role, created: ensured.created, redirect }

  if (mode === "get") {
    return withCookies(NextResponse.redirect(new URL(redirect, originOf(req)), 303), session.cookies)
  }
  return withCookies(NextResponse.json(payload), session.cookies)
}

/** تسجيل الدخول الآلي: يكتب كوكيز الجلسة ثم يحوّل إلى لوحة الفئة (أو `next`). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req, "get")
}

/** نفس المنطق بجسم JSON — لمن يفضّل نداءً برمجيًا ثم تنقّلًا بعدها. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req, "post")
}
