"use server"

import { revalidatePath } from "next/cache"
import { eq, ilike } from "drizzle-orm"
import { db, getConnectionString } from "@/lib/db"
import { events, troupes, venues, type PriceTier } from "@/lib/db/schema"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { getSupabaseUser } from "@/lib/supabase/session-server"

/**
 * نشر عمل مسرحي من «مساحة عمل الفرقة» إلى **كتالوج العروض العام**.
 *
 * كان النشر يبقى داخل حساب الفرقة فقط (الحالة «معروض للبيع» في جدول productions
 * على Supabase) فلا يظهر في الصفحة الرئيسية ولا في `/shows` ولا يمكن حجزه.
 * هذا الإجراء ينشئ/يُحدّث العرض الحقيقي في قاعدة العروض (+ المسرح + الفرقة)
 * ثم يربط الصفّ بمُعرّف العرض (`event_slug`) ويُحدّث صفحات الموقع فورًا.
 */

export type PublishCatalogueResult = { ok: boolean; error?: string; slug?: string; bookable?: boolean }

/** معرّف نصي آمن للعرض من العنوان (يعمل مع العناوين العربية عبر بديل عشوائي). */
function slugBase(title: string): string {
  const latin = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
  return latin.length >= 3 ? latin : `show-${Math.random().toString(36).slice(2, 10)}`
}

type ProductionRow = {
  id: string
  title: string
  poster_url: string | null
  venue_name: string | null
  venue_city: string | null
  seating_mode: string
  rows: number
  seats_per_row: number
  capacity: number
  tiers: { id: string; name: string; priceEgp: number; color: string; rows: number[] }[]
  starts_at: string | null
  showtimes: string[]
  event_slug: string | null
}

export async function publishProductionToCatalogue(productionId: string): Promise<PublishCatalogueResult> {
  const user = await getSupabaseUser()
  if (!user?.email) return { ok: false, error: "سجّل الدخول أولًا ثم أعد المحاولة." }

  if (!getConnectionString()) {
    return {
      ok: false,
      error:
        "كتالوج العروض العام يحتاج اتصال قاعدة البيانات (DATABASE_URL). العرض محفوظ في حسابك، وبمجرد ضبط الاتصال سيُنشر بضغطة واحدة.",
    }
  }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  // 1) قراءة العمل والتحقق من الملكية.
  const { data, error } = await admin
    .from("productions")
    .select(
      "id, owner_id, title, poster_url, venue_name, venue_city, seating_mode, rows, seats_per_row, capacity, tiers, starts_at, showtimes, event_slug",
    )
    .eq("id", productionId)
    .maybeSingle()

  if (error || !data) return { ok: false, error: "لم يُعثر على العمل المسرحي." }

  const row = data as ProductionRow & { owner_id: string }
  if (row.owner_id !== user.id) return { ok: false, error: "لا تملك صلاحية نشر هذا العمل." }

  // 2) التحقق من اكتمال التفاصيل المطلوبة للنشر العام.
  const startsAtRaw = row.starts_at || row.showtimes?.[0] || ""
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "أضف موعدًا واحدًا على الأقل للعرض قبل النشر." }
  }
  const tiers = Array.isArray(row.tiers) ? row.tiers : []
  if (tiers.length === 0) return { ok: false, error: "أضف فئة سعر واحدة على الأقل قبل النشر." }
  if (!row.venue_name || row.venue_name.trim().length === 0) {
    return { ok: false, error: "حدّد مكان العرض قبل النشر." }
  }

  const seatingMode = row.seating_mode === "general_admission" ? "general_admission" : "numbered"
  const rows = Math.max(1, Number(row.rows) || 8)
  const seatsPerRow = Math.max(1, Number(row.seats_per_row) || 12)
  const capacity = Math.max(1, Number(row.capacity) || rows * seatsPerRow)

  // 3) المسرح: نستخدم المسرح المسجَّل إن وُجد بالاسم، وإلا ننشئ مسرحًا «خارجيًا».
  const venueName = row.venue_name.trim()
  const existingVenue = await db.select({ id: venues.id }).from(venues).where(ilike(venues.name, venueName)).limit(1)

  let venueId = existingVenue[0]?.id ?? 0
  if (!venueId) {
    const inserted = await db
      .insert(venues)
      .values({
        slug: `venue-${Math.random().toString(36).slice(2, 10)}`,
        name: venueName,
        city: (row.venue_city ?? "").trim() || "القاهرة",
        address: "",
        rows,
        seatsPerRow: seatingMode === "numbered" ? seatsPerRow : Math.max(1, Math.ceil(capacity / 8)),
      })
      .returning({ id: venues.id })
    venueId = inserted[0]?.id ?? 0
  }
  if (!venueId) return { ok: false, error: "تعذّر تجهيز مكان العرض." }

  // 4) الفرقة: نستخدم فرقة بنفس الاسم إن وُجدت، وإلا ننشئها من اسم صاحب الحساب.
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const troupeName =
    [metadata.full_name, metadata.name].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ??
    user.email.split("@")[0] ??
    "فرقة كواليس"

  const existingTroupe = await db.select({ id: troupes.id }).from(troupes).where(ilike(troupes.name, troupeName)).limit(1)

  let troupeId = existingTroupe[0]?.id ?? 0
  if (!troupeId) {
    const inserted = await db
      .insert(troupes)
      .values({
        slug: `troupe-${Math.random().toString(36).slice(2, 10)}`,
        name: troupeName,
        bio: "",
        city: (row.venue_city ?? "").trim() || null,
      })
      .returning({ id: troupes.id })
    troupeId = inserted[0]?.id ?? 0
  }
  if (!troupeId) return { ok: false, error: "تعذّر تجهيز الفرقة." }

  // 5) تحويل فئات الأسعار إلى شكل الكتالوج (بالقروش).
  const priceTiers: PriceTier[] = tiers.map((tier, index) => ({
    id: String(tier.id ?? `tier-${index}`),
    name: String(tier.name ?? `فئة ${index + 1}`),
    priceCents: Math.max(0, Math.round(Number(tier.priceEgp ?? 0) * 100)),
    color: String(tier.color ?? "#f59e0b"),
    rows: Array.isArray(tier.rows) ? tier.rows.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [],
  }))

  // 6) إنشاء/تحديث العرض في الكتالوج (مع تجنّب تشابه الرابط مع عرض فرقة أخرى).
  const desiredSlug = row.event_slug && row.event_slug.trim().length > 0 ? row.event_slug.trim() : slugBase(row.title)
  const clash = await db
    .select({ troupeId: events.troupeId })
    .from(events)
    .where(eq(events.slug, desiredSlug))
    .limit(1)
  const slug =
    clash.length > 0 && clash[0].troupeId !== troupeId
      ? `${desiredSlug}-${Math.random().toString(36).slice(2, 6)}`
      : desiredSlug

  const payload = {
    slug,
    title: row.title,
    tagline: "",
    description: `${row.title} — عرض لفرقة ${troupeName} على مسرح ${venueName}.`,
    posterUrl: row.poster_url ?? null,
    heroUrl: row.poster_url ?? null,
    troupeId,
    venueId,
    startsAt,
    priceTiers,
    status: "on_sale",
    hasInteractiveSeats: seatingMode === "numbered",
  }

  try {
    const existing = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1)
    if (existing.length > 0) {
      await db.update(events).set(payload).where(eq(events.id, existing[0].id))
    } else {
      await db.insert(events).values(payload)
    }
  } catch (insertError) {
    const message = insertError instanceof Error ? insertError.message : String(insertError)
    console.error(`[catalogue] نشر «${row.title}» فشل: ${message}`)
    return { ok: false, error: `تعذّر نشر العرض في الكتالوج: ${message}` }
  }

  // 7) ربط العمل بمُعرّف العرض المنشور (لتحديثه لاحقًا بلا تكرار).
  await admin.from("productions").update({ event_slug: slug, status: "on_sale" }).eq("id", productionId)

  // 8) تحديث الصفحات فورًا: الرئيسية · العروض · صفحة العرض · لوحة الفرقة.
  revalidatePath("/")
  revalidatePath("/shows")
  revalidatePath(`/shows/${slug}`)
  revalidatePath("/dashboard/troupe")

  console.log(`[catalogue] نُشر العرض «${row.title}» على /shows/${slug}`)
  return { ok: true, slug, bookable: true }
}
