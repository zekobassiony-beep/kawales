"use server"

import { revalidatePath } from "next/cache"

/**
 * محاكاة تفاعلات لوحات التحكم (عروض/أودشنات/طلبات/خصومات) قبل ربط المصادقة
 * وقاعدة البيانات. كل دالة تُعيد نجاحًا فوريًا وتُعيد توليد الصفحة.
 */
export async function submitTroupeShow(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { ok: false as const, error: "عنوان العرض مطلوب." }
  revalidatePath("/dashboard/troupe")
  return { ok: true as const, message: `تم استلام عرض «${title}» للمراجعة والنشر.` }
}

export async function submitAudition(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { ok: false as const, error: "عنوان الأودشن مطلوب." }
  revalidatePath("/dashboard/troupe")
  return { ok: true as const, message: `تم نشر الأودشن «${title}».` }
}

export async function reviewApplication(applicationId: string, decision: "accepted" | "rejected") {
  if (!applicationId) return { ok: false as const, error: "الطلب غير معروف." }
  revalidatePath("/dashboard/troupe")
  return {
    ok: true as const,
    message: decision === "accepted" ? "تم قبول الطلب." : "تم رفض الطلب.",
  }
}

/** التحقق من تذكرة عند البوابة بصيغة المرجع KW-XXXXXX. */
export async function verifyTicket(reference: string) {
  const code = reference.trim().toUpperCase()
  if (!/^KW-[A-Z0-9]{6}$/.test(code)) {
    return { ok: false as const, error: "صيغة المرجع غير صحيحة. مثال: KW-ABC123." }
  }
  return { ok: true as const, message: `التذكرة ${code} صالحة — يُسمح بالدخول.` }
}

export async function applyToAudition(auditionId: string) {
  if (!auditionId) return { ok: false as const, error: "الأودشن غير معروف." }
  revalidatePath("/dashboard/actor")
  return { ok: true as const, message: "تم إرسال طلبك — ستظهر حالته في جدول الطلبات." }
}

export async function updateActorProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { ok: false as const, error: "الاسم مطلوب." }
  revalidatePath("/dashboard/actor")
  return { ok: true as const, message: "تم حفظ الملف الشخصي." }
}

export async function updateVenueLayout(formData: FormData) {
  const rows = Number(formData.get("rows"))
  const seatsPerRow = Number(formData.get("seatsPerRow"))
  if (!Number.isInteger(rows) || rows < 1 || rows > 26) {
    return { ok: false as const, error: "عدد الصفوف يجب أن يكون بين 1 و 26." }
  }
  if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 40) {
    return { ok: false as const, error: "عدد المقاعد لكل صف يجب أن يكون بين 1 و 40." }
  }
  revalidatePath("/dashboard/venue")
  return { ok: true as const, message: `تم حفظ التخطيط: ${rows} صفوف × ${seatsPerRow} مقعدًا.` }
}

export async function toggleOffPeakDeal(dealId: string, active: boolean) {
  if (!dealId) return { ok: false as const, error: "الخصم غير معروف." }
  revalidatePath("/dashboard/venue")
  return { ok: true as const, message: active ? "تم تفعيل الخصم." : "تم إيقاف الخصم." }
}