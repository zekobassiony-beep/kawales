"use client"

import { useEffect } from "react"
import { getSupabaseAuthUser, isAuthConfigured } from "@/lib/supabase/auth-client"
import {
  applySupabaseUser,
  mergeServerProfile,
  persistSession,
  readSession,
  type AccountRole,
} from "@/lib/session"
import { isAccountRole } from "@/lib/roles"
import { loadMyProfile, saveMyProfile } from "@/app/actions/profile"
import { startWorkspaceSync, stopWorkspaceSync } from "@/lib/productions-sync"

/**
 * مزامنة جلسة Supabase Auth الرسمية مع جلسة المنصة المحلية.
 *
 * تُركّب مرة واحدة في `app/layout.tsx`:
 *  - عند وجود جلسة Supabase ⇒ تُطبَّق على الجلسة المحلية (فتظهر في كل الواجهات).
 *  - ثم يُقرأ **الملف المحفوظ في قاعدة البيانات** (جدول `profiles`) ويُدمج، وإن كان
 *    الحساب جديدًا يُنشأ له صف فورًا — فلا يعيد المستخدم إكمال بياناته من جديد.
 *  - عند غياب أي جلسة ⇒ **تُمسح أي جلسة محلية قديمة** حتى لا يستطيع أحد الدخول
 *    بجلسة وهمية محفوظة في المتصفح (المصادقة الحقيقية هي المصدر الوحيد).
 */
export function SupabaseSessionSync() {
  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      try {
        const user = await getSupabaseAuthUser()
        if (cancelled) return

        if (!user) {
          // لا جلسة حقيقية: نُنظّف الجلسة المحلية القديمة (إن وُجدت) ونوقف مزامنة مساحة العمل.
          stopWorkspaceSync()
          if (isAuthConfigured() && readSession()) persistSession(null)
          return
        }

        // الفئة المفضّلة من الرابط (?role=troupe) عند العودة من /auth/callback.
        const roleParam = new URLSearchParams(window.location.search).get("role")
        const preferredRole: AccountRole | undefined =
          roleParam && isAccountRole(roleParam) ? roleParam : undefined

        const applied = applySupabaseUser(user, preferredRole)
        if (!applied) return

        // الحفظ الدائم: نقرأ الملف من قاعدة البيانات وندمجه في الجلسة، وإن لم يكن
        // للحساب صف بعد (أول دخول) نُنشئه فورًا — فيبقى الحساب مسجَّلًا في الداتا.
        const remote = await loadMyProfile()
        if (cancelled || !remote.ok) return
        if (remote.profile) {
          mergeServerProfile(remote.profile, user.email ?? applied.email)
        } else {
          await saveMyProfile({ role: applied.role, onboarded: applied.onboarded, profile: applied.profile })
        }

        // مساحة العمل (الأعمال/الأودشنات/الدعوات) تُقرأ من Supabase وتُزامَن تلقائيًا.
        startWorkspaceSync()
      } catch {
        // فشل المزامنة لا يجب أن يعطّل الواجهة.
      }
    }

    void sync()
    const onFocus = () => void sync()
    window.addEventListener("focus", onFocus)
    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  return null
}
