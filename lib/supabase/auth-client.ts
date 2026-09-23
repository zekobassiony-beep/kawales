"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config"

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

export type AuthActionResult = { ok: boolean; error?: string }

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
