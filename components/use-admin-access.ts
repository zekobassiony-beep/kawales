"use client"

import { useEffect, useState } from "react"
import { checkAdminAccessAction } from "@/app/actions/admin-access"
import { isMasterAdminEmail } from "@/lib/auth-constants"
import { useSession } from "@/lib/session"

/**
 * هل الجلسة الحالية أدمن (سوبر أدمن أو مُضاف في جدول `admin_users`)؟
 *
 * - التحقق الأول فوري بلا شبكة: بريد السوبر أدمن المعروف (`MASTER_ADMIN_EMAILS`).
 * - ثم نداء سيرفر واحد ليشمل بقية الأدمنز المُضافين من اللوحة.
 * - الزائر المجهول (بلا جلسة محلية) لا يُكلَّف أي نداء.
 *
 * ⚠️ هذا للواجهة فقط (إظهار/إخفاء رابط)؛ الحماية الحقيقية على السيرفر:
 * `middleware.ts` + `checkAdminAccess()`.
 */
export function useAdminAccess(): { allowed: boolean; master: boolean; checking: boolean } {
  const user = useSession()
  const email = user?.email ?? ""
  const masterGuess = isMasterAdminEmail(email)
  const [server, setServer] = useState<{ allowed: boolean; master: boolean } | null>(null)

  useEffect(() => {
    if (!email) {
      setServer(null)
      return
    }
    let active = true
    checkAdminAccessAction()
      .then((access) => {
        if (active) setServer({ allowed: access.allowed, master: access.master })
      })
      .catch(() => {
        if (active) setServer({ allowed: false, master: false })
      })
    return () => {
      active = false
    }
  }, [email])

  return {
    allowed: masterGuess || Boolean(server?.allowed),
    master: masterGuess || Boolean(server?.master),
    checking: Boolean(email) && server === null && !masterGuess,
  }
}
