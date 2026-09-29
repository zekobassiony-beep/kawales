"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"
import { createAccountWithPassword } from "@/app/actions/auth"
import { isAccountRole } from "@/lib/roles"
import { arabicAuthError } from "@/lib/auth-errors"

/**
 * Supabase Auth على المتصفح (Google OAuth + Email OTP).
 *
 * يستخدم `createBrowserClient` من `@supabase/ssr` حتى تُحفظ الجلسة في **كوكيز**
 * (لا في localStorage) فيقرأها السيرفر والوسيط `middleware.ts` عبر `getUser()`.
 */
let authClient: SupabaseClient | null | undefined

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (authClient !== undefined) return authClient
  if (!isSupabaseConfigured()) {
    authClient = null
    return null
  }
  authClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { detectSessionInUrl: true, flowType: "pkce" },
  })
  return authClient
}

/** مسار الـ callback الرسمي على هذا الأصل (origin). */
export function authCallbackUrl(next?: string, role?: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin
  const params = new URLSearchParams()
  if (next) params.set("next", next)
  if (role) params.set("role", role)
  const query = params.toString()
  return `${origin}/auth/callback${query ? `?${query}` : ""}`
}

export type AuthActionResult = {
  ok: boolean
  error?: string
  /** يحتاج المستخدم لتسجيل الدخول بدل الإنشاء (البريد مسجّل بحساب فعّال). */
  needsSignIn?: boolean
  /** مزوّد الحساب المسجَّل بالبريد: google ⇒ أنشأه صاحبه بحساب جوجل (بلا كلمة مرور). */
  provider?: "google" | "password"
  /** (توافق خلفي) لم يبقَ مسار تأكيد بالبريد — القيمة دائمًا false. */
  needsEmailConfirmation?: boolean
}

/** (يُعاد تصديره للتوافق) ترجمة رسائل أخطاء المصادقة إلى العربية. */
export { arabicAuthError }

/**
 * إنشاء حساب جديد ببريد وكلمة مرور — **تأكيد فوري بلا بريد إلكتروني**.
 *
 * يُنشأ الحساب على السيرفر بمفتاح الخدمة (`app/actions/auth.ts`) فيكون مؤكَّدًا
 * مباشرة، ثم تُفتح الجلسة هنا بكلمة المرور نفسها — فلا حاجة لرابط تأكيد قد لا يصل.
 * إن كان البريد مسجّلًا بحساب فعّال ⇒ `needsSignIn` مع رسالة توجّهه إلى تسجيل الدخول.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  input: { next?: string; role?: string } = {},
): Promise<AuthActionResult> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return { ok: false, error: "المصادقة غير مهيأة على هذا المشروع (تحقق من متغيّرات البيئة)." }

  const normalized = email.trim().toLowerCase()

  // المسار الأساسي: إنشاء الحساب على السيرفر بمفتاح الخدمة (تأكيد فوري — بلا
  // انتظار بريد تأكيد لا يصل)، ثم فتح الجلسة من المتصفح بكلمة المرور نفسها.
  const created = await createAccountWithPassword({
    email: normalized,
    password,
    role: isAccountRole(input.role) ? input.role : undefined,
  })
  if (!created.ok) {
    return { ok: false, error: created.error, needsSignIn: created.needsSignIn, provider: created.provider }
  }

  const signed = await signInWithPassword(normalized, password)
  if (!signed.ok) {
    return {
      ok: false,
      needsSignIn: true,
      error: "أُنشئ الحساب بنجاح لكن تعذّر فتح الجلسة — اضغط «تسجيل الدخول» بنفس كلمة المرور.",
    }
  }
  return { ok: true }
}

/** تسجيل الدخول ببريد وكلمة مرور (مصادقة حقيقية — كلمة مرور خاطئة = رفض). */
export async function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return { ok: false, error: "المصادقة غير مهيأة على هذا المشروع (تحقق من متغيّرات البيئة)." }

  const normalized = email.trim().toLowerCase()
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password })
  if (error) return { ok: false, error: arabicAuthError(error.message) }
  if (!data.session) return { ok: false, error: "لم تُفتح الجلسة — أعد المحاولة." }
  return { ok: true }
}

/** هل المصادقة الحقيقية متاحة على هذا المشروع؟ */
export function isAuthConfigured(): boolean {
  return isSupabaseConfigured()
}

/** تسجيل الدخول عبر Google (يفتح شاشة اختيار الحساب ثم يعود إلى /auth/callback). */
export async function signInWithGoogle(input: { next?: string; role?: string } = {}): Promise<AuthActionResult> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(input.next, input.role),
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  })
  if (error) return { ok: false, error: `تعذّر الدخول بجوجل: ${error.message}` }
  return { ok: true }
}

/** يرسل كود تحقق (6 أرقام) إلى البريد + رابط سحري يعود إلى /auth/callback. */
export async function sendEmailOtp(email: string, input: { next?: string; role?: string } = {}): Promise<AuthActionResult> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { ok: false, error: "أدخل بريدًا إلكترونيًا صحيحًا." }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackUrl(input.next, input.role),
    },
  })
  if (error) return { ok: false, error: `تعذّر إرسال الكود: ${error.message}` }
  return { ok: true }
}

/** يتحقق من كود البريد (Email OTP) ويُنشئ الجلسة. */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthActionResult> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return { ok: false, error: "Supabase غير مهيأ (تحقق من متغيّرات البيئة)." }
  const code = token.replace(/\D/g, "")
  if (code.length !== 6) return { ok: false, error: "أدخل الكود المكوّن من 6 أرقام." }

  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: "email",
  })
  if (error) return { ok: false, error: `كود غير صحيح أو منتهي: ${error.message}` }
  return { ok: true }
}

/** المستخدم الحالي من جلسة Supabase (أو null). */
export async function getSupabaseAuthUser(): Promise<User | null> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ?? null
}

/** إنهاء جلسة Supabase (مع إبقاء إنهاء الجلسة المحلية للمنادي). */
export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return
  await supabase.auth.signOut().catch(() => undefined)
}
