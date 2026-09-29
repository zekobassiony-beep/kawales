"use server"

import { getSupabaseAdmin } from "@/lib/supabase/server"
import { getSupabaseUser, providerFromSupabaseUser } from "@/lib/supabase/session-server"
import { isAccountRole, type AccountRole } from "@/lib/roles"
import type { SessionProfile } from "@/lib/session"

/**
 * ملف المستخدم الدائم على Supabase (جدول `profiles`) — حفظ وقراءة.
 *
 * - الحفظ يتطلب **جلسة Supabase حقيقية** (كوكيز الجلسة) ثم يُكتب بمفتاح
 *   الخدمة على السيرفر، فلا يستطيع أحد كتابة ملف غيره.
 * - يعمل بنفس الطريقة لحساب البريد/كلمة المرور ولحساب Google.
 * - لا اعتماد على `localStorage` هنا: هذا هو المصدر الدائم الذي يجعل المستخدم
 *   يجد بياناته بعد تسجيل الدخول من أي متصفح.
 */

const PROFILES_TABLE = "profiles"
const TABLE_MISSING_MESSAGE =
  "جدول profiles غير موجود على Supabase — شغّل الملف scripts/profiles-schema.sql من SQL Editor مرة واحدة."

/** كل الحقول النصية في الملف (تُنقّى وتُقصّ قبل الحفظ). */
const PROFILE_TEXT_KEYS = [
  "avatarUrl",
  "fullName",
  "stageName",
  "ageGroup",
  "city",
  "portfolioUrl",
  "skills",
  "troupeName",
  "directorName",
  "logoUrl",
  "vodafoneCash",
  "instaPay",
  "bio",
  "venueName",
  "inviteCode",
] as const

const MAX_TEXT_LENGTH = 4000

export type StoredProfile = {
  id: string
  email: string
  role: AccountRole
  provider: string
  onboarded: boolean
  fullName: string
  avatarUrl: string
  profile: Partial<SessionProfile>
}

export type ProfileResult =
  | { ok: true; profile: StoredProfile | null; tableReady: boolean }
  | { ok: false; error: string; tableReady: boolean }

/** هل الخطأ يعني أن الجدول غير موجود؟ */
function isTableMissing(message: string | undefined): boolean {
  return /does not exist|schema cache|relation/i.test(message ?? "")
}

/** ينقّي حقول الملف: نصوص فقط، مقصوصة، وبلا مفاتيح غريبة. */
function sanitizeProfile(raw: unknown): Partial<SessionProfile> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const clean: Record<string, unknown> = {}

  for (const key of PROFILE_TEXT_KEYS) {
    const value = source[key]
    if (typeof value === "string" && value.trim().length > 0) {
      clean[key] = value.trim().slice(0, MAX_TEXT_LENGTH)
    }
  }
  if (typeof source.telegramLinked === "boolean") clean.telegramLinked = source.telegramLinked

  return clean as Partial<SessionProfile>
}

/** يحوّل صف قاعدة البيانات إلى كائن مُطبَّع للواجهة. */
function rowToProfile(row: Record<string, unknown>): StoredProfile {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    role: isAccountRole(row.role) ? row.role : "customer",
    provider: String(row.provider ?? "password"),
    onboarded: row.onboarded === true,
    fullName: String(row.full_name ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
    profile: sanitizeProfile(row.profile),
  }
}

/** يقرأ ملف المستخدم الحالي من قاعدة البيانات (أو null إن لم يوجد صف بعد). */
export async function loadMyProfile(): Promise<ProfileResult> {
  const user = await getSupabaseUser()
  if (!user) return { ok: false, error: "غير مصرّح — لا توجد جلسة نشطة.", tableReady: false }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر.", tableReady: false }

  const { data, error } = await admin
    .from(PROFILES_TABLE)
    .select("id, email, role, provider, onboarded, full_name, avatar_url, profile")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.warn(`[profile] load failed: ${error.message}`)
    return {
      ok: false,
      error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message,
      tableReady: false,
    }
  }
  if (!data) return { ok: true, profile: null, tableReady: true }
  return { ok: true, profile: rowToProfile(data as Record<string, unknown>), tableReady: true }
}

/**
 * يحفظ (أو يُحدّث) ملف المستخدم الحالي — يُستدعى بعد إنشاء الحساب وبعد إكمال
 * بيانات `/onboarding`، فيبقى الحساب وملفه محفوظين في قاعدة البيانات.
 */
export async function saveMyProfile(input: {
  role?: string
  onboarded?: boolean
  profile?: unknown
}): Promise<ProfileResult> {
  const user = await getSupabaseUser()
  if (!user?.email) {
    return { ok: false, error: "غير مصرّح — سجّل الدخول أولًا ثم أعد المحاولة.", tableReady: false }
  }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر.", tableReady: false }

  const cleanProfile = sanitizeProfile(input.profile)
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const metadataRole = isAccountRole(metadata.role) ? metadata.role : undefined
  const role: AccountRole = isAccountRole(input.role) ? input.role : (metadataRole ?? "customer")
  const fullName = typeof cleanProfile.fullName === "string" ? cleanProfile.fullName : ""
  const avatarUrl = typeof cleanProfile.avatarUrl === "string" ? cleanProfile.avatarUrl : ""

  const row = {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    role,
    provider: providerFromSupabaseUser(user),
    onboarded: input.onboarded === true,
    full_name: fullName,
    avatar_url: avatarUrl,
    profile: cleanProfile,
  }

  const { error } = await admin.from(PROFILES_TABLE).upsert(row, { onConflict: "id" })
  if (error) {
    console.warn(`[profile] save failed: ${error.message}`)
    return {
      ok: false,
      error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message,
      tableReady: false,
    }
  }

  return { ok: true, profile: rowToProfile({ ...row, profile: cleanProfile }), tableReady: true }
}

/**
 * يضبط كلمة مرور لحساب المستخدم **الحالي** فقط.
 *
 * يفيد الحسابات التي أُنشئت بجوجل (بلا كلمة مرور) فيصير للحساب الواحد طريقتا
 * دخول معًا بلا تعارض: جوجل أو البريد + كلمة المرور.
 * لا يصلح لتغيير كلمة مرور حساب آخر: المعرّف يأتي من الجلسة نفسها.
 */
export async function setMyPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSupabaseUser()
  if (!user?.email) {
    return { ok: false, error: "سجّل الدخول أولًا (بجوجل مثلًا) ثم أعد المحاولة لإضافة كلمة مرور." }
  }

  const value = (password ?? "").trim()
  if (value.length < 6) return { ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }
  if (value.length > 72) return { ok: false, error: "كلمة المرور طويلة جدًا (72 حرفًا كحد أقصى)." }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return { ok: false, error: "خدمة الحسابات غير مهيأة على السيرفر (تحقّق من SUPABASE_SERVICE_ROLE_KEY)." }
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: value, email_confirm: true })
  if (error) {
    console.error(`[profile] set password failed for ${user.email}: ${error.message}`)
    return { ok: false, error: `تعذّر ضبط كلمة المرور: ${error.message}` }
  }

  console.log(`[profile] أُضيفت كلمة مرور لحساب: ${user.email}`)
  return { ok: true }
}
