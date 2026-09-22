/** الحالة الوحيدة التي يُسمح فيها بالحجز. */
export const ON_SALE_STATUS = "on_sale"

export type SaleWindow = {
  status: string
  startsAt: Date | string
}

/**
 * يُرجع سببًا موجّهًا للزائر حين يتعذّر حجز العرض، أو `null` حين يكون الحجز
 * متاحًا. تُستخدم في server action وفي صفحات العرض.
 */
export function bookingBlockedReason(event: SaleWindow, now: Date = new Date()): string | null {
  if (event.status !== ON_SALE_STATUS) {
    if (event.status === "sold_out") return "لقد نفدت تذاكر هذا العرض."
    if (event.status === "cancelled") return "تم إلغاء هذا العرض."
    return "تذاكر هذا العرض غير متاحة للبيع حاليًا."
  }

  const startsAt = event.startsAt instanceof Date ? event.startsAt : new Date(event.startsAt)
  if (Number.isNaN(startsAt.getTime())) return "لم يُحدَّد موعد نهائي لهذا العرض بعد."
  if (startsAt.getTime() <= now.getTime()) {
    return "لقد بدأ هذا العرض بالفعل، لذا أُغلق الحجز أونلاين."
  }

  return null
}
