import { cookies } from "next/headers"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { ADMIN_USERS_TABLE, MASTER_ADMIN_EMAIL, SESSION_EMAIL_COOKIE } from "@/lib/auth-constants"

/**
 * حماية ودخول السوبر أدمن — إدارة المسؤولين عبر جدول `admin_users` في Supabase.
 *
 * - البريد الأساسي (`MASTER_ADMIN_EMAIL`) مصرّح دائمًا حتى لو غاب الجدول.
 * - بقية الأدمنز يُتحقق منهم من جدول `admin_users` (خدمة service_role).
 *
 * ملف سيرفر فقط (يستعمل `next/headers` ومفتاح الخدمة).
 */

export { ADMIN_USERS_TABLE, MASTER_ADMIN_EMAIL, SESSION_EMAIL_COOKIE }

/** رسالة توضيحية عند غياب جدول `admin_users`. */
export const ADMIN_TABLE_MISSING_MESSAGE =
  "جدول admin_users غير موجود في Supabase — شغّل الملف scripts/admin-users-schema.sql من SQL Editor مرة واحدة."

/** تطبيع البريد (حروف صغيرة بلا مسافات). */
export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase()
}

/** هل هذا البريد هو السوبر أدمن الأساسي؟ */
export function isMasterAdmin(email?: string | null): boolean {
  return normalizeEmail(email) === MASTER_ADMIN_EMAIL
}

/** يقرأ بريد الجلسة من الكوكي (انعكاس للجلسة المحلية) — للسيرفر فقط. */
export async function getSessionEmail(): Promise<string> {
  const store = await cookies()
  return normalizeEmail(store.get(SESSION_EMAIL_COOKIE)?.value)
}

export type AdminListResult = {
  ok: boolean
  emails: string[]
  /** هل جدول admin_users متاح؟ (لإظهار تنبيه الإعداد في الواجهة) */
  tableReady: boolean
}

/** قائمة بريدات الأدمن من Supabase (مرتبة زمنيًا من الأقدم). */
export async function listAdminEmails(): Promise<AdminListResult> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, emails: [MASTER_ADMIN_EMAIL], tableReady: false }

  const { data, error } = await admin
    .from(ADMIN_USERS_TABLE)
    .select("email")
    .order("created_at", { ascending: true })

  if (error) {
    console.warn(`[auth] list admin_users failed: ${error.message}`)
    return { ok: false, emails: [MASTER_ADMIN_EMAIL], tableReady: false }
  }

  const emails = (data ?? [])
    .map((row) => normalizeEmail((row as { email?: string }).email))
    .filter((email) => email.length > 0)
  if (!emails.includes(MASTER_ADMIN_EMAIL)) emails.unshift(MASTER_ADMIN_EMAIL)
  return { ok: true, emails, tableReady: true }
}

/** هل هذا البريد مصرّح له بالدخول كلوحة تحكم عليا؟ */
export async function isAdminEmail(email?: string | null): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  if (isMasterAdmin(normalized)) return true

  const admin = getSupabaseAdmin()
  if (!admin) return false
  const { data, error } = await admin
    .from(ADMIN_USERS_TABLE)
    .select("email")
    .eq("email", normalized)
    .maybeSingle()
  if (error) {
    console.warn(`[auth] admin check failed for ${normalized}: ${error.message}`)
    return false
  }
  return Boolean(data)
}

export type AdminAccess = {
  email: string
  allowed: boolean
  /** هل هو البريد الأساسي غير القابل للحذف؟ */
  master: boolean
}

/** يتحقق من صلاحية جلسة السيرفر الحالية للوصول إلى لوحة الأدمن. */
export async function checkAdminAccess(): Promise<AdminAccess> {
  const email = await getSessionEmail()
  const master = isMasterAdmin(email)
  return { email, master, allowed: await isAdminEmail(email) }
}

/**
 * يحفظ بريد أدمن جديد في جدول admin_users.
 * يعيد رسالة خطأ واضحة (بالعربية) عند الفشل — بما فيها غياب الجدول.
 */
export async function addAdminEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeEmail(email)
  if (!normalized) return { ok: false, error: "أدخل بريدًا إلكترونيًا صحيحًا." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "صيغة البريد غير صحيحة." }
  }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }

  const { error } = await admin.from(ADMIN_USERS_TABLE).insert({ email: normalized })
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { ok: false, error: ADMIN_TABLE_MISSING_MESSAGE }
    }
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "هذا البريد مضاف بالفعل كأدمن." }
    }
    return { ok: false, error: `تعذّرت الإضافة: ${error.message}` }
  }
  return { ok: true }
}

/** يحذف بريد أدمن (مع منع حذف البريد الأساسي). */
export async function removeAdminEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeEmail(email)
  if (!normalized) return { ok: false, error: "بريد غير صالح." }
  if (isMasterAdmin(normalized)) {
    return { ok: false, error: "لا يمكن حذف البريد الأساسي للسوبر أدمن." }
  }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }

  const { error } = await admin.from(ADMIN_USERS_TABLE).delete().eq("email", normalized)
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { ok: false, error: ADMIN_TABLE_MISSING_MESSAGE }
    }
    return { ok: false, error: `تعذّر الحذف: ${error.message}` }
  }
  return { ok: true }
}
