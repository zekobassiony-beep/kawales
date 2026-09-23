"use server"

import {
  addAdminEmail,
  checkAdminAccess,
  listAdminEmails,
  removeAdminEmail,
  type AdminListResult,
} from "@/lib/auth"

/**
 * إجراءات إدارة المسؤولين (جدول `admin_users` على Supabase).
 * كل إجراء يتحقق أولًا من صلاحية الجلسة الحالية (طبقة حماية إضافية
 * فوق الوسيط `middleware.ts`).
 */

/** يقرأ قائمة الأدمنز (للواجهة). */
export async function fetchAdminEmails(): Promise<AdminListResult> {
  const access = await checkAdminAccess()
  if (!access.allowed) return { ok: false, emails: [], tableReady: false }
  return listAdminEmails()
}

export type AdminMutationResult = {
  ok: boolean
  error?: string
  /** القائمة المحدّثة بعد العملية (لتحديث الواجهة فورًا). */
  emails?: string[]
  tableReady?: boolean
}

/** إضافة أدمن جديد بالبريد. */
export async function addAdminEmailAction(email: string): Promise<AdminMutationResult> {
  const access = await checkAdminAccess()
  if (!access.allowed) return { ok: false, error: "غير مصرّح — هذه العملية للسوبر أدمن فقط." }

  const result = await addAdminEmail(email)
  if (!result.ok) return result

  const list = await listAdminEmails()
  return { ok: true, emails: list.emails, tableReady: list.tableReady }
}

/** حذف أدمن بالبريد (مع منع حذف البريد الأساسي). */
export async function removeAdminEmailAction(email: string): Promise<AdminMutationResult> {
  const access = await checkAdminAccess()
  if (!access.allowed) return { ok: false, error: "غير مصرّح — هذه العملية للسوبر أدمن فقط." }

  const result = await removeAdminEmail(email)
  if (!result.ok) return result

  const list = await listAdminEmails()
  return { ok: true, emails: list.emails, tableReady: list.tableReady }
}
