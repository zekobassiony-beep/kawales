/**
 * ثوابت صلاحيات الأدمن — ملف بيانات صرف (بلا اعتماد على السيرفر أو المتصفح)
 * لذا يُستورد من وسيط Next (`middleware.ts`) والمتصفح والسيرفر معًا.
 */

/** البريد الأساسي للسوبر أدمن (Master Admin) — مصرّح دائمًا وغير قابل للحذف. */
export const MASTER_ADMIN_EMAIL = "zeko.bassiony@gmail.com"

/** جدول الأدمنز على Supabase. */
export const ADMIN_USERS_TABLE = "admin_users"

/** كوكي انعكاسي لبريد الجلسة (يقرأه الوسيط لأن الجلسة محلية). */
export const SESSION_EMAIL_COOKIE = "kawalees:email"

/** المسارات المحميّة الخاصة بالأدمن. */
export const ADMIN_PATHS = ["/admin", "/dashboard/admin"]

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

/** هل هذا البريد هو السوبر أدمن الأساسي؟ */
export function isMasterAdminEmail(email?: string | null): boolean {
  return normalizeAdminEmail(email) === MASTER_ADMIN_EMAIL
}
