"use client"

import { useSyncExternalStore } from "react"
import {
  LOGIN_PATH,
  ONBOARDING_PATH,
  ROLE_DASHBOARD_PATH,
  ROLE_LABELS,
  isAccountRole,
  type AccountRole,
} from "@/lib/roles"
import { signOutSupabase } from "@/lib/supabase/auth-client"
import type { User } from "@supabase/supabase-js"

/**
 * جلسة المستخدم على الواجهة (مصدرها الحقيقي: Supabase Auth).
 *
 * - المصادقة حقيقية عبر Supabase (`lib/supabase/auth-client.ts`) — لا توجد أي
 *   دالة «دخول وهمي». الجلسة المحلية هنا مجرد انعكاس سريع للواجهة في
 *   `localStorage`، وتُبنى دائمًا من مستخدم Supabase الرسمي.
 * - بيانات إكمال الملف تُحفظ **دائمًا في قاعدة البيانات** (جدول `profiles` عبر
 *   `app/actions/profile.ts`) ثم تُدمج هنا بـ `mergeServerProfile`، فيجد
 *   المستخدم بياناته بعد تسجيل الدخول من أي جهاز.
 */

/** يُعاد تصدير بيانات الفئات حتى يبقى `@/lib/session` هو مدخل الجلسة الوحيد. */
export * from "@/lib/roles"

export type AuthProvider = "password" | "google"

/**
 * حقول إكمال الملف لكل الفئات في كائن واحد؛ الحقول التي لا تنتمي لفئة
 * المستخدم تبقى فارغة، وهذا يُبقي الحفظ والقراءة من التخزين المحلي بسيطين.
 */
export type SessionProfile = {
  avatarUrl: string
  fullName: string
  telegramLinked: boolean
  stageName: string
  ageGroup: string
  city: string
  portfolioUrl: string
  skills: string
  troupeName: string
  directorName: string
  logoUrl: string
  vodafoneCash: string
  instaPay: string
  bio: string
  venueName: string
  inviteCode: string
}

export type SessionUser = {
  /** الاسم المعروض في الهيدر (يُحدَّث تلقائيًا بعد إكمال البيانات). */
  name: string
  email: string
  role: AccountRole
  provider: AuthProvider
  /** هل أكمل المستخدم بيانات `/onboarding`؟ */
  onboarded: boolean
  profile: SessionProfile
}

export const SESSION_STORAGE_KEY = "kawalees:session"
export const SESSION_CHANGE_EVENT = "kawalees:session-change"

export function emptyProfile(): SessionProfile {
  return {
    avatarUrl: "",
    fullName: "",
    telegramLinked: false,
    stageName: "",
    ageGroup: "",
    city: "",
    portfolioUrl: "",
    skills: "",
    troupeName: "",
    directorName: "",
    logoUrl: "",
    vodafoneCash: "",
    instaPay: "",
    bio: "",
    venueName: "",
    inviteCode: "",
  }
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

/** يقرأ حقول الملف مع ترحيل الجلسات القديمة (avatarUrl كان في أعلى الجلسة). */
function parseProfile(raw: unknown, legacyAvatar: string): SessionProfile {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    avatarUrl: text(source.avatarUrl, legacyAvatar),
    fullName: text(source.fullName),
    telegramLinked: source.telegramLinked === true,
    stageName: text(source.stageName),
    ageGroup: text(source.ageGroup),
    city: text(source.city),
    portfolioUrl: text(source.portfolioUrl),
    skills: text(source.skills),
    troupeName: text(source.troupeName),
    directorName: text(source.directorName),
    logoUrl: text(source.logoUrl),
    vodafoneCash: text(source.vodafoneCash),
    instaPay: text(source.instaPay),
    bio: text(source.bio),
    venueName: text(source.venueName),
    inviteCode: text(source.inviteCode),
  }
}

function parseSession(raw: string | null): SessionUser | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as Record<string, unknown>
    if (!isAccountRole(candidate.role)) return null
    const role = candidate.role
    return {
      name: text(candidate.name) || ROLE_LABELS[role],
      email: text(candidate.email),
      role,
      provider: candidate.provider === "google" ? "google" : "password",
      onboarded: candidate.onboarded === true,
      profile: parseProfile(candidate.profile, text(candidate.avatarUrl)),
    }
  } catch {
    return null
  }
}

/*
 * `useSyncExternalStore` يشترط أن يكون مرجع اللقطة (snapshot) ثابتًا بين
 * الاستدعاءات، لذلك نخزّن آخر قيمة مقروءة ونُعيدها ما لم يتغيّر التخزين.
 */
let cachedRaw: string | null = null
let cachedUser: SessionUser | null = null

/** يقرأ الجلسة من التخزين المحلي (يُعيد `null` على السيرفر أو بلا جلسة). */
export function readSession(): SessionUser | null {
  if (typeof window === "undefined") return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedUser = parseSession(raw)
  }
  return cachedUser
}

/** يحفظ الجلسة (أو يحذفها عند تمرير `null`) ويُبلغ كل المكونات المستمعة. */
export function persistSession(user: SessionUser | null): void {
  if (typeof window === "undefined") return
  const raw = user ? JSON.stringify(user) : null
  try {
    if (raw) window.localStorage.setItem(SESSION_STORAGE_KEY, raw)
    else window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // التخزين المحلي قد يكون معطّلًا (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  // ملاحظة أمنية: لم يبقَ أي كوكي بريد مكتوب من المتصفح — حماية مسارات الأدمن
  // تتم في الوسيط (`middleware.ts`) من جلسة Supabase الرسمية فقط.
  cachedRaw = raw
  cachedUser = user
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
}

/** كل الحقول النصية في الملف — تُدمج من السيرفر عند غيابها محليًا. */
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

/** لقطة ملف المستخدم القادمة من السيرفر (جدول `profiles`). */
export type ServerProfileSnapshot = {
  role?: string
  onboarded?: boolean
  fullName?: string
  avatarUrl?: string
  provider?: string
  profile?: Partial<SessionProfile>
}

/**
 * يدمج الملف المحفوظ في قاعدة البيانات مع الجلسة المحلية.
 *
 * - السيرفر هو مصدر الحقيقة لـ «الفئة» و«إكمال البيانات»، فيتوقف تكرار
 *   `/onboarding` عند كل دخول أو تغيير جهاز.
 * - القيم النصية من السيرفر تُطبَّق عندما تكون فارغة محليًا فقط، فلا تُفقد
 *   أي بيانات أدخلها المستخدم للتو في نفس الجلسة.
 */
export function mergeServerProfile(snapshot: ServerProfileSnapshot, email?: string): SessionUser | null {
  const current = readSession()
  if (!current) return null

  const target = (email ?? current.email).trim().toLowerCase()
  if (current.email.trim().toLowerCase() !== target) return null

  const role: AccountRole = isAccountRole(snapshot.role) ? snapshot.role : current.role
  const serverProfile = parseProfile(snapshot.profile ?? {}, "")
  const profile: SessionProfile = { ...current.profile }
  const writable = profile as unknown as Record<string, unknown>

  for (const key of PROFILE_TEXT_KEYS) {
    const value = serverProfile[key]
    const local = profile[key]
    if (typeof value === "string" && value.trim().length > 0 && local.trim().length === 0) {
      writable[key] = value
    }
  }
  profile.telegramLinked = serverProfile.telegramLinked || current.profile.telegramLinked

  const snapshotName = (snapshot.fullName ?? "").trim()
  if (snapshotName.length > 0 && profile.fullName.trim().length === 0) profile.fullName = snapshotName
  const snapshotAvatar = (snapshot.avatarUrl ?? "").trim()
  if (snapshotAvatar.length > 0 && profile.avatarUrl.trim().length === 0) profile.avatarUrl = snapshotAvatar

  const displayName = displayNameForProfile(role, profile)
  const user: SessionUser = {
    ...current,
    role,
    onboarded: snapshot.onboarded === true || current.onboarded,
    profile,
    name: displayName.length > 0 ? displayName : current.name,
  }
  persistSession(user)
  return user
}

/** اسم مبدئي قبل إكمال البيانات: بادئة البريد أو اسم الفئة. */
function defaultNameFor(role: AccountRole, email: string): string {
  const prefix = email.split("@")[0]?.trim() ?? ""
  return prefix.length > 0 ? prefix : ROLE_LABELS[role]
}

/** الاسم المعروض بعد إكمال البيانات حسب الفئة. */
export function displayNameForProfile(role: AccountRole, profile: SessionProfile): string {
  const candidates: Record<AccountRole, string[]> = {
    customer: [profile.fullName],
    actor: [profile.stageName, profile.fullName],
    troupe: [profile.troupeName, profile.fullName],
    venue: [profile.venueName, profile.fullName],
  }
  return candidates[role].map((value) => value.trim()).find((value) => value.length > 0) ?? ""
}

/**
 * ملاحظة: لا توجد دالة «دخول وهمي» — الدخول وإنشاء الحساب يتمّان عبر Supabase Auth
 * (`lib/supabase/auth-client.ts`) ثم تُطبَّق الجلسة بـ `applySupabaseUser` أدناه.
 */

/** الخطوة الثانية: حفظ بيانات البروفايل ووسم الحساب كمكتمل. */
export function completeOnboarding(profile: SessionProfile): SessionUser | null {
  const current = readSession()
  if (!current) return null
  const displayName = displayNameForProfile(current.role, profile)
  const user: SessionUser = {
    ...current,
    profile,
    onboarded: true,
    name: displayName.length > 0 ? displayName : current.name,
  }
  persistSession(user)
  return user
}

/** تحديث جزئي للبروفايل (مثل وسم ربط تليجرام) دون إعادة بناء الجلسة. */
export function updateProfile(patch: Partial<SessionProfile>): SessionUser | null {
  const current = readSession()
  if (!current) return null
  const profile = { ...current.profile, ...patch }
  const displayName = displayNameForProfile(current.role, profile)
  const user: SessionUser = {
    ...current,
    profile,
    name: displayName.length > 0 ? displayName : current.name,
  }
  persistSession(user)
  return user
}

export function signOut(): void {
  // إنهاء جلسة Supabase الرسمية أيضًا (كوكيز) بجانب الجلسة المحلية.
  void signOutSupabase()
  persistSession(null)
}

/**
 * يزامن مستخدم Supabase Auth الرسمي مع الجلسة المحلية (مصدر واجهة المنصة):
 * يحافظ على الفئة (role) والبروفايل إن كانت الجلسة المحلية لنفس البريد،
 * ويستنبط الاسم والصورة من بيانات Supabase (Google/Email).
 */
export function applySupabaseUser(
  user: Pick<User, "email" | "user_metadata" | "app_metadata"> | null,
  preferredRole?: AccountRole,
): SessionUser | null {
  if (!user?.email) return null
  const email = user.email.trim().toLowerCase()
  const current = readSession()
  const sameUser = Boolean(current && current.email.trim().toLowerCase() === email)

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const pickText = (values: unknown[]): string =>
    values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? ""

  const fullName = pickText([metadata.full_name, metadata.name, metadata.user_name])
  const avatarUrl = pickText([metadata.avatar_url, metadata.picture])
  const providerRaw = pickText([(user.app_metadata ?? {})["provider"]])
  const provider: AuthProvider = providerRaw === "google" ? "google" : "password"

  const role: AccountRole = sameUser && current ? current.role : (preferredRole ?? "customer")
  const profile: SessionProfile =
    sameUser && current
      ? {
          ...current.profile,
          fullName: current.profile.fullName || fullName,
          avatarUrl: current.profile.avatarUrl || avatarUrl,
        }
      : { ...emptyProfile(), fullName, avatarUrl }

  const resolvedName =
    (sameUser && current ? current.name : "") ||
    fullName ||
    defaultNameFor(role, email)

  const next: SessionUser = {
    name: resolvedName,
    email,
    role,
    provider,
    onboarded: sameUser && current ? current.onboarded : false,
    profile,
  }
  persistSession(next)
  return next
}

/** لوحة الفئة المناسبة، ومن لم يكمل بياناته يُوجَّه إلى `/onboarding`. */
export function dashboardPathForUser(user: SessionUser | null): string {
  if (!user) return LOGIN_PATH
  return user.onboarded ? ROLE_DASHBOARD_PATH[user.role] : ONBOARDING_PATH
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(SESSION_CHANGE_EVENT, onStoreChange)
  // يُغطي تغيير الجلسة من تبويب آخر لنفس الموقع.
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = () => null

/** الجلسة الحالية كمُخزَّن خارجي (بدون Hydration mismatch). */
export function useSession(): SessionUser | null {
  return useSyncExternalStore(subscribe, readSession, getServerSnapshot)
}
