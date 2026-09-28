"use server"

import { checkAdminAccess } from "@/lib/auth"

/**
 * تحقق سريع من صلاحية الجلسة الحالية كأدمن.
 *
 * يُستخدم لإظهار رابط «لوحة الإدارة» في الهيدر للفئة الصحيحة فقط **دون** كشف قائمة
 * الأدمنز في المتصفح: السيرفر يفحص كوكي الجلسة + جدول `admin_users` ويعيد النتيجة.
 * (الحماية الفعلية تبقى في `middleware.ts` + `checkAdminAccess()` على السيرفر.)
 */
export async function checkAdminAccessAction(): Promise<{ allowed: boolean; master: boolean }> {
  try {
    const access = await checkAdminAccess()
    return { allowed: access.allowed, master: access.master }
  } catch (error) {
    console.warn(`[auth] checkAdminAccessAction failed: ${error instanceof Error ? error.message : error}`)
    return { allowed: false, master: false }
  }
}
