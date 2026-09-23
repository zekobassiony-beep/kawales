"use client"

import { useEffect } from "react"
import { getSupabaseAuthUser } from "@/lib/supabase/auth-client"
import { applySupabaseUser, type AccountRole } from "@/lib/session"
import { isAccountRole } from "@/lib/roles"

/**
 * مزامنة جلسة Supabase Auth الرسمية مع جلسة المنصة المحلية.
 *
 * تُركّب مرة واحدة في `app/layout.tsx`: عند أي تحميل للصفحة تُقرأ جلسة
 * Supabase (`getUser()`) وتُطبَّق على الجلسة المحلية — فيظهر المستخدم
 * المسجّل عبر Google/Email OTP في كل الواجهات (الهيدر واللوحات).
 */
export function SupabaseSessionSync() {
  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      try {
        const user = await getSupabaseAuthUser()
        if (cancelled || !user) return

        // الفئة المفضّلة من الرابط (?role=troupe) عند العودة من /auth/callback.
        const roleParam = new URLSearchParams(window.location.search).get("role")
        const preferredRole: AccountRole | undefined =
          roleParam && isAccountRole(roleParam) ? roleParam : undefined

        applySupabaseUser(user, preferredRole)
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
