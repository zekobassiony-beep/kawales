"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db, getConnectionString } from "@/lib/db"
import { venues } from "@/lib/db/schema"

/**
 * إجراء سيرفر لحفظ رابط الخريطة (Google Maps) لمسرح — يُستخدم في لوحة مدير
 * المسرح وفي لوحة السوبر أدمن.
 */
export async function updateVenueMapsUrl(
  venueId: number,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!getConnectionString()) {
    return { ok: false, error: "لا توجد قاعدة بيانات مهيأة (DATABASE_URL مفقود)." }
  }

  const trimmed = url.trim()
  if (trimmed.length > 0 && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "الرابط يجب أن يبدأ بـ http أو https." }
  }

  try {
    await db
      .update(venues)
      .set({ googleMapsUrl: trimmed.length > 0 ? trimmed : null })
      .where(eq(venues.id, venueId))
    revalidatePath("/dashboard/venue")
    revalidatePath("/shows", "layout")
    return { ok: true }
  } catch (error) {
    return { ok: false, error: `تعذّر الحفظ: ${error instanceof Error ? error.message : String(error)}` }
  }
}
