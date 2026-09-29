"use server"

import { arabicAuthError } from "@/lib/auth-errors"
import { isAccountRole, type AccountRole } from "@/lib/roles"
import { getSupabaseAdmin } from "@/lib/supabase/server"

/**
 * إنشاء حساب حقيقي **دون الاعتماد على البريد الإلكتروني**.
 *
 * المشكلة التي يحلّها: إعداد «تأكيد البريد» في Supabase يُنشئ المستخدم بلا جلسة
 * ثم يُرسل رابط تأكيد عبر بريد الخدمة المدمج — وهو محدود جدًا وقد لا يصل أبدًا،
 * فيبقى المستخدم غير قادر على الدخول («لم يتم تأكيد بريدك»).
 *
 * الحل: يُنشأ المستخدم بمفتاح الخدمة (`service_role`) على السيرفر مع
 * `email_confirm: true` ⇒ الحساب **مؤكَّد فورًا** ويستطيع تسجيل الدخول مباشرة.
 * وبعدها يُفتح الدخول من المتصفح بكلمة المرور نفسها فتُحفظ الجلسة في الكوكيز.
 *
 * حالات البريد الموجود مسبقًا:
 *  - حساب **غير مؤكَّد** (لا يستطيع الدخول أصلًا) ⇒ يُفعَّل وتُضبط كلمة المرور الجديدة.
 *  - حساب **مؤكَّد** ⇒ يُرفض الطلب ويُطلب تسجيل الدخول (لا يمكن لأحد تغيير كلمة مرور
 *    حساب فعّال يملكه غيره).
 */

export type CreateAccountResult = {
  ok: boolean
  error?: string
  /** كان الحساب موجودًا بلا تأكيد فتم تفعيله الآن. */
  activated?: boolean
  /** البريد يملك حسابًا فعّالًا — الحل هو تسجيل الدخول لا الإنشاء. */
  needsSignIn?: boolean
  /** مزوّد الحساب الموجود بهذا البريد (google ⇒ أنشأه صاحبه بحساب جوجل). */
  provider?: "google" | "password"
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6
/** أقصى عدد صفحات نبحث فيها عن حساب موجود (200 مستخدم لكل صفحة). */
const LOOKUP_PAGES = 3

/** هل خطأ GoTrue يعني أن البريد مسجّل بالفعل؟ */
function isAlreadyRegistered(message: string | undefined, code: string | undefined): boolean {
  const raw = (message ?? "").toLowerCase()
  const normalizedCode = (code ?? "").toLowerCase()
  return (
    normalizedCode === "email_exists" ||
    normalizedCode === "user_already_exists" ||
    raw.includes("already been registered") ||
    raw.includes("already registered") ||
    raw.includes("already exists")
  )
}

type FoundUser = {
  id: string
  emailConfirmed: boolean
  fullName?: string
  /** مزوّدو الدخول المرتبطون بالحساب على Supabase (`email` و/أو `google`). */
  providers: string[]
}

/** يبحث عن مستخدم بالبريد في الصفحات الأولى (بحث محدود لا يُثقل المشروع). */
async function findUserByEmail(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
): Promise<FoundUser | null> {
  for (let page = 1; page <= LOOKUP_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.warn(`[auth] تعذّر البحث عن الحساب (صفحة ${page}): ${error.message}`)
      return null
    }
    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? "").trim().toLowerCase() === email)
    if (match) {
      const metadata = (match.user_metadata ?? {}) as Record<string, unknown>
      const appMetadata = (match.app_metadata ?? {}) as Record<string, unknown>
      const providers = Array.isArray(appMetadata.providers)
        ? appMetadata.providers.filter((value): value is string => typeof value === "string")
        : []
      return {
        id: match.id,
        emailConfirmed: Boolean(match.email_confirmed_at),
        fullName: typeof metadata.full_name === "string" ? metadata.full_name : undefined,
        providers,
      }
    }
    if (users.length < 200) break // آخر صفحة — لا داعي لمزيد من النداءات.
  }
  return null
}

export async function createAccountWithPassword(input: {
  email: string
  password: string
  role?: AccountRole
  fullName?: string
}): Promise<CreateAccountResult> {
  const email = (input.email ?? "").trim().toLowerCase()
  const password = input.password ?? ""
  const role: AccountRole = isAccountRole(input.role) ? input.role : "customer"

  if (!EMAIL_RE.test(email)) return { ok: false, error: "أدخل بريدًا إلكترونيًا صحيحًا." }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` }
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    const message =
      "خدمة الحسابات غير مهيأة على السيرفر — تحقّق من SUPABASE_SERVICE_ROLE_KEY و NEXT_PUBLIC_SUPABASE_URL."
    console.error(`[auth] إنشاء حساب فشل: ${message}`)
    return { ok: false, error: message }
  }

  const metadata: Record<string, unknown> = { role }
  const fullName = (input.fullName ?? "").trim()
  if (fullName.length > 0) metadata.full_name = fullName

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (!created.error) {
    console.log(`[auth] أُنشئ حساب مؤكَّد فورًا: ${email} (role=${role})`)
    return { ok: true }
  }

  const { message: rawMessage, code } = created.error as { message?: string; code?: string }

  if (!isAlreadyRegistered(rawMessage, code)) {
    console.error(`[auth] فشل إنشاء الحساب ${email}: code=${code ?? "-"} message=${rawMessage ?? "-"}`)
    return { ok: false, error: arabicAuthError(rawMessage) }
  }

  // البريد موجود مسبقًا: نُفعّله فقط إن كان غير مؤكَّد (لا يملكه أحد فعليًا بعد).
  const existing = await findUserByEmail(admin, email)
  if (!existing) {
    return {
      ok: false,
      needsSignIn: true,
      error: "هذا البريد مسجّل بالفعل — جرّب «تسجيل الدخول» بنفس كلمة المرور.",
    }
  }

  if (existing.emailConfirmed) {
    // حساب جوجل (بلا كلمة مرور) لا يمكن إنشاؤه من جديد ولا تغيير كلمة مروره هنا؛
    // نُخبر الواجهة بالمزوّد لتوجّه المستخدم إلى الزر الصحيح.
    const googleOnly = existing.providers.includes("google") && !existing.providers.includes("email")
    return {
      ok: false,
      needsSignIn: true,
      provider: googleOnly ? "google" : "password",
      error: googleOnly
        ? "هذا البريد مسجَّل بالفعل بحساب Google — استخدم «المتابعة بحساب Google»، أو «تسجيل الدخول» إن كنت قد ضبطت كلمة مرور للحساب."
        : "هذا البريد مسجّل ومؤكَّد بالفعل — استخدم «تسجيل الدخول» بكلمة مروره الحالية.",
    }
  }

  const activated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (activated.error) {
    console.error(`[auth] تعذّر تفعيل الحساب غير المؤكَّد ${email}: ${activated.error.message}`)
    return { ok: false, error: arabicAuthError(activated.error.message) }
  }

  console.log(`[auth] فُعّل حساب كان غير مؤكَّد: ${email} — يستطيع الدخول الآن.`)
  return { ok: true, activated: true }
}
