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

/** يقرأ بريدات السوبر أدمن الإضافية من متغيّرات البيئة. */
function readMasterEmailsFromEnv(): string[] {
  return [process.env.MASTER_ADMIN_EMAIL, process.env.MASTER_ADMIN_EMAILS, process.env.SUPER_ADMIN_EMAIL]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(",")
    .split(/[,\s;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"))
}

/** كل بريدات السوبر أدمن المعتمدة (الافتراضي + ما يُضاف من البيئة). */
export const MASTER_ADMIN_EMAILS: string[] = Array.from(
  new Set([...readMasterEmailsFromEnv(), DEFAULT_MASTER_ADMIN_EMAIL]),
)

/** البريد الأساسي المعروض في الواجهات. */
export const MASTER_ADMIN_EMAIL = MASTER_ADMIN_EMAILS[0] ?? DEFAULT_MASTER_ADMIN_EMAIL

/** جدول الأدمنز على Supabase. */
export const ADMIN_USERS_TABLE = "admin_users"

/** كوكي انعكاسي لبريد الجلسة (يقرأه الوسيط لأن الجلسة محلية). */
export const SESSION_EMAIL_COOKIE = "kawalees:email"

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
