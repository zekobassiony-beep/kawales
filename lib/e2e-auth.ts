/**
 * وضع اختبار E2E — توثيق آلي موحّد للاختبارات الشاملة (End-to-End).
 *
 * المشكلة التي يحلّها: الدخول في المنصة مصادقة Supabase حقيقية عبر نافذة على
 * `/login` لا تصبح قابلة للتفاعل إلا بعد النقر على بطاقة فئة، ولا يوجد أي حساب
 * اختبار جاهز على Supabase — فيفشل المشغّل الآلي عند أول خطوة («الدخول») وتفشل
 * معه كل التدفقات التالية (حجز/بوابة/فرقة/أدمن) رغم أن الخلل في خطوة واحدة.
 *
 * الحل: مسار توثيق **حقيقي** (يفتح جلسة Supabase ويكتب كوكيزها) مُقيَّد بعلامة
 * بيئة وسرّ، مع السماح للبريد التجريبي بتجاوز بوابة الأدمن في الاختبار فقط.
 *
 * ⚠️ أمان:
 *  - الوضع **معطّل افتراضيًا**، ولا يُفعَّل إلا بـ `KAWALEES_E2E_AUTH=1`
 *    **و** سرّ غير فارغ في `KAWALEES_E2E_AUTH_TOKEN` معًا.
 *  - يُمنع تلقائيًا على بيئة Vercel الإنتاجية (`VERCEL_ENV=production`) إلا عند
 *    تجاوز صريح بـ `KAWALEES_E2E_AUTH_ALLOW_PRODUCTION=1`.
 *
 * ملف نقي (بلا سيرفر أو متصفح)، لذا يُستورد من الوسيط `middleware.ts` (يعمل على
 * Edge) ومن معالج المسار `app/api/e2e/auth/route.ts` ومن الاختبارات معًا.
 *
 * ملاحظة مهمة: كل قراءة لـ `process.env.X` هنا **حرفية (ثابتة) عن قصد**، لأن Next
 * يستبدلها بالقيمة وقت البناء في الوسيط — أما الوصول الديناميكي (`env[key]`) فلا يعمل
 * هناك. ولهذا لا نخزّن الإعدادات في متغيّر وحدة (module-level) حتى تقرأ الاختبارات
 * القيم الجديدة بعد تغيير البيئة.
 */

import { ROLE_DASHBOARD_PATH, isAccountRole, type AccountRole } from "@/lib/roles"

/** متغيّر تفعيل الوضع (القيمة `1`/`true`/`yes`/`on`). */
export const E2E_AUTH_FLAG_ENV = "KAWALEES_E2E_AUTH"
/** السرّ المطلوب في كل طلب (ترويسة أو `?token=`). */
export const E2E_AUTH_TOKEN_ENV = "KAWALEES_E2E_AUTH_TOKEN"
/** بريدات إضافية تُسمح لها بتجاوز بوابة الأدمن في الاختبار (مفصولة بفواصل). */
export const E2E_AUTH_EMAILS_ENV = "KAWALEES_E2E_AUTH_EMAILS"
/** بريد الحساب التجريبي الافتراضي (يُنشأ تلقائيًا عند أول استخدام). */
export const E2E_AUTH_EMAIL_ENV = "KAWALEES_E2E_AUTH_EMAIL"
/** كلمة مرور الحساب التجريبي الافتراضي. */
export const E2E_AUTH_PASSWORD_ENV = "KAWALEES_E2E_AUTH_PASSWORD"
/** تجاوز صريح لمنع الوضع في الإنتاج. */
export const E2E_AUTH_ALLOW_PRODUCTION_ENV = "KAWALEES_E2E_AUTH_ALLOW_PRODUCTION"

/** ترويسة السرّ التي يرسلها المشغّل الآلي في كل طلب. */
export const E2E_AUTH_TOKEN_HEADER = "x-kawalees-e2e-token"

/**
 * البريد الافتراضي للحساب التجريبي.
 *
 * اختياره ليس عشوائيًا: `admin@kawalees.test` مذكور مسبقًا في `lib/roles.ts`
 * (`SUPERADMIN_EMAILS`) وفي تلميح بوابة غرفة العمليات `app/hq-kawalees/hq-gate.tsx`،
 * فيصبح نفس الحساب قادرًا على فتح كل المسارات المحميّة (المنتج/البوابة/الأدمن/غرفة
 * العمليات) في الاختبار بلا أي تعديل يدوي على جدول `admin_users`.
 */
export const DEFAULT_E2E_EMAIL = "admin@kawalees.test"

/** كلمة مرور افتراضية ثابتة (يمكن تجاوزها بمتغيّر البيئة). */
export const DEFAULT_E2E_PASSWORD = "kawalees-e2e-2026"


/** تطبيع بريد (حروف صغيرة بلا مسافات) — يعيد "" للقيم غير النصية. */
export function normalizeE2EEmail(value?: string | null): string {
  return (value ?? "").trim().toLowerCase()
}

/** هل قيمة متغيّر البيئة تعني «مُفعَّل»؟ */
export function isE2EFlagOn(value?: string | null): boolean {
  const normalized = (value ?? "").trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

/**
 * يفكّ قائمة بريدات مفصولة بفواصل/مسافات/فاصلات منقوطة ويُطبّعها ويُزيل التكرار.
 * القيم غير البريدية (بلا `@`) تُتجاهل.
 */
export function parseE2EEmails(raw?: string | null): string[] {
  const seen = new Set<string>()
  for (const part of String(raw ?? "").split(/[,\s;]+/)) {
    const email = normalizeE2EEmail(part)
    if (email.includes("@")) seen.add(email)
  }
  return Array.from(seen)
}

/**
 * مقارنة سرّ بزمن ثابت (تقلّل تسريب التوقيت). اختلاف الطول يُرفض فورًا،
 * ثم تُطابَق كل المحارف ويُجمع الفرق بـ XOR.
 */
export function verifyE2EToken(provided?: string | null, expected?: string | null): boolean {
  const candidate = (provided ?? "").trim()
  const secret = (expected ?? "").trim()
  if (secret.length === 0 || candidate.length !== secret.length) return false
  let diff = 0
  for (let index = 0; index < secret.length; index += 1) {
    diff |= candidate.charCodeAt(index) ^ secret.charCodeAt(index)
  }
  return diff === 0
}

/** هل هذا المسار نسبي آمن للتوجيه (يمنع `//evil.com` وأي مخطط خارجي)؟ */
export function isSafeE2EPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes("://")
}

/** الفئة المطلوبة، و`customer` عند غيابها أو خطئها. */
export function resolveE2ERole(value: unknown): AccountRole {
  return isAccountRole(value) ? value : "customer"
}

/** وجهة ما بعد التوثيق: `next` إن كان آمنًا، وإلا لوحة الفئة. */
export function resolveE2ERedirect(role: AccountRole, next?: string | null): string {
  const requested = (next ?? "").trim()
  if (isSafeE2EPath(requested)) return requested
  return ROLE_DASHBOARD_PATH[role]
}

/**
 * هل خطأ Supabase/GoTrue يعني أن البريد مسجَّل بالفعل؟
 * (نسخة نقية مطابقة لمنطق `app/actions/auth.ts` لتُختبر بسهولة.)
 */
export function isE2EAccountExistsError(message?: string | null, code?: string | null): boolean {
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

export type E2EAuthConfig = {
  /** هل الوضع مُفعَّل (علامة + سرّ + غير محظور في الإنتاج)؟ */
  enabled: boolean
  /** السرّ المطلوب في الطلبات (فارغ ⇒ الوضع معطّل). */
  token: string
  /** البريدات المسموح لها بتجاوز بوابة الأدمن في الاختبار. */
  emails: string[]
  /** بريد الحساب التجريبي الافتراضي. */
  email: string
  /** كلمة مرور الحساب التجريبي الافتراضي. */
  password: string
  /** سبب التعطيل (للتشخيص/السجلّات) — فارغ عند التفعيل. */
  disabledReason: string
}

/**
 * يقرأ إعدادات وضع الاختبار من البيئة.
 *
 * لا نخزّن النتيجة: تُقرأ في كل نداء حتى تعمل الاختبارات وتُطبَّق قيم البناء الحديثة.
 */
export function readE2EConfig(): E2EAuthConfig {
  const flag = (process.env.KAWALEES_E2E_AUTH ?? "").trim()
  const token = (process.env.KAWALEES_E2E_AUTH_TOKEN ?? "").trim()
  const email = normalizeE2EEmail(process.env.KAWALEES_E2E_AUTH_EMAIL) || DEFAULT_E2E_EMAIL
  const password = (process.env.KAWALEES_E2E_AUTH_PASSWORD ?? "").trim() || DEFAULT_E2E_PASSWORD
  const productionBlocked =
    (process.env.VERCEL_ENV ?? "").trim().toLowerCase() === "production" &&
    !isE2EFlagOn(process.env.KAWALEES_E2E_AUTH_ALLOW_PRODUCTION)

  // البريد الافتراضي والبريد المُهيَّأ يبقيان مسموحين دائمًا بجانب القائمة الصريحة.
  const allowed = new Set(parseE2EEmails(process.env.KAWALEES_E2E_AUTH_EMAILS))
  allowed.add(email)
  allowed.add(DEFAULT_E2E_EMAIL)

  let disabledReason = ""
  if (!isE2EFlagOn(flag)) disabledReason = `${E2E_AUTH_FLAG_ENV} غير مُفعَّلة`
  else if (token.length === 0) disabledReason = `${E2E_AUTH_TOKEN_ENV} غير مهيَّأ`
  else if (productionBlocked) disabledReason = "الوضع ممنوع في الإنتاج (VERCEL_ENV=production)"

  return {
    enabled: disabledReason.length === 0,
    token,
    emails: Array.from(allowed),
    email,
    password,
    disabledReason,
  }
}

/** هل وضع التوثيق الآلي مُفعَّل؟ (يُستخدم في الوسيط للسماح بمرور الحساب التجريبي). */
export function isE2EAuthEnabled(): boolean {
  return readE2EConfig().enabled
}

/**
 * هل هذا بريد الحساب التجريبي المسموح له بتجاوز بوابة الأدمن؟
 * يعيد `false` دائمًا عندما يكون الوضع معطّلًا — فلا أثر على الإنتاج.
 */
export function isE2ETestEmail(value?: string | null): boolean {
  const config = readE2EConfig()
  if (!config.enabled) return false
  const email = normalizeE2EEmail(value)
  return email.length > 0 && config.emails.includes(email)
}
