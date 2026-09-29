/**
 * ثوابت صلاحيات الأدمن — ملف بيانات صرف (بلا اعتماد على السيرفر أو المتصفح)
 * لذا يُستورد من وسيط Next (`middleware.ts`) والمتصفح والسيرفر معًا.
 */

/**
 * بريد السوبر أدمن الأساسي (Master Admin) — مصرّح دائمًا وغير قابل للحذف.
 *
 * مرونة بلا تعديل كود: يمكن تغيير البريد الأساسي بمتغيّر البيئة `MASTER_ADMIN_EMAIL`،
 * وإضافة بريدات سوبر أدمن أخرى (مفصولة بفواصل) في `MASTER_ADMIN_EMAILS`
 * أو `SUPER_ADMIN_EMAIL` — مع بقاء البريد الافتراضي مصرّحًا حتى لا يُقفل المالك خارج اللوحة.
 */
const DEFAULT_MASTER_ADMIN_EMAIL = "zeko.bassiony@gmail.com"

/**
 * يفكّ قائمة بريدات مفصولة بفواصل/مسافات/فاصلات منقوطة ويُطبّعها
 * (حروف صغيرة + تجاهل أي قيمة ليست بريدًا) — دالة نقية قابلة للاختبار.
 */
export function parseMasterEmails(raw: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(raw ?? "")
        .split(/[,\s;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@")),
    ),
  )
}

/**
 * يقرأ بريدات السوبر أدمن الإضافية من متغيّرات البيئة (سيرفر + متصفح).
 *
 * ⚠️ الوصول لـ `process.env.X` هنا **ثابت (حرفي)** عن قصد: Next يستبدل هذا النوع
 * بالقيمة وقت البناء في الوسيط والمتصفح، أما الوصول الديناميكي (`env[key]`) فلا يعمل هناك.
 */
function readMasterEmailsFromEnv(): string[] {
  return parseMasterEmails(
    [
      process.env.MASTER_ADMIN_EMAIL,
      process.env.MASTER_ADMIN_EMAILS,
      process.env.SUPER_ADMIN_EMAIL,
      // نسخة عامة (NEXT_PUBLIC_) ليتمكّن المتصفح أيضًا من عرض رابط «لوحة الإدارة»
      // لنفس البريدات المُضافة على السيرفر.
      process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL,
      process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAILS,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(","),
  )
}

/** كل بريدات السوبر أدمن المعتمدة (الافتراضي + ما يُضاف من البيئة). */
export const MASTER_ADMIN_EMAILS: string[] = Array.from(
  new Set([...readMasterEmailsFromEnv(), DEFAULT_MASTER_ADMIN_EMAIL]),
)

/** البريد الأساسي المعروض في الواجهات. */
export const MASTER_ADMIN_EMAIL = MASTER_ADMIN_EMAILS[0] ?? DEFAULT_MASTER_ADMIN_EMAIL

/** جدول الأدمنز على Supabase. */
export const ADMIN_USERS_TABLE = "admin_users"

/**
 * ملاحظة أمنية: كان هنا كوكي `kawalees:email` يُكتب من المتصفح ويُقرأ في الوسيط
 * للتحقق من الأدمن — وقد أُزيل بالكامل لأن أي زائر كان يستطيع كتابته ببريد
 * السوبر أدمن فيدخل اللوحة بلا كلمة مرور. التحقق الآن من جلسة Supabase الرسمية
 * (`supabase.auth.getUser()`) فقط، في `middleware.ts` و`@/lib/auth`.
 */

/**
 * المسارات المحميّة للوحات التشغيل:
 * - `/admin` و`/dashboard/admin`: لوحة الإدارة/السوبر أدمن.
 * - `/producer`: اختصار لوحة المخرج ومنظّم العروض.
 * - `/gatekeeper`: اختصار بوابة المسرح (مسح التذاكر وتسجيل الحضور).
 */
export const ADMIN_PATHS = ["/admin", "/dashboard/admin", "/producer", "/gatekeeper"]

/** لوحة السوبر أدمن (الوجهة النهائية). */
export const ADMIN_DASHBOARD_PATH = "/dashboard/admin"

/** هل المسار المطلوب من مسارات الأدمن؟ */
export function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/** تطبيع البريد (حروف صغيرة بلا مسافات). */
export function normalizeAdminEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase()
}

/** هل هذا البريد هو أحد بريدات السوبر أدمن (يفهم تعدّد البريدات من البيئة)؟ */
export function isMasterAdminEmail(email?: string | null): boolean {
  return MASTER_ADMIN_EMAILS.includes(normalizeAdminEmail(email))
}
