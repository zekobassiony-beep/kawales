import { cache } from "react"
import { db, getConnectionString } from "@/lib/db"
import { events, troupes, venues, bookedSeats, bookings } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import type { Troupe } from "@/lib/db/schema"
import { getSupabaseAdmin } from "@/lib/supabase/server"

export type EventWithRelations = {
  id: number
  slug: string
  title: string
  tagline: string
  description: string
  category: string
  language: string
  durationMinutes: number
  posterUrl: string | null
  heroUrl: string | null
  startsAt: Date
  featured: boolean
  status: string
  /** رابط برومو/تريلر الفيديو (اختياري). */
  trailerUrl: string | null
  /** هل يدعم العرض خصم الشلة؟ */
  hasGroupDiscount: boolean
  /** هل للعرض مقاعد تفاعلية مرقّمة (true) أم فئات تذاكر عامة فقط (false)؟ */
  hasInteractiveSeats: boolean
  priceTiers: { id: string; name: string; priceCents: number; color: string; rows: number[] }[]
  troupe: { id: number; name: string; slug: string; bio: string; city: string | null }
  venue: {
    id: number
    name: string
    slug: string
    city: string
    address: string
    /** رابط Google Maps المباشر (اختياري) — يُدخله مدير المسرح. */
    googleMapsUrl: string | null
    rows: number
    seatsPerRow: number
  }
}

const mockTroupes: Troupe[] = [
  {
    id: 1,
    slug: "al-masrah-al-hur",
    name: "مسرح الحر المستقل",
    bio: "فرقة مستقلة تعرض الدراما العربية المعاصرة بين القاهرة والإسكندرية منذ تأسيسها.",
    imageUrl: null,
    foundedYear: 2008,
    city: "القاهرة",
    createdAt: new Date("2008-01-01"),
  },
  {
    id: 2,
    slug: "bayt-al-hikma",
    name: "فرقة بيت الحكمة",
    bio: "فرقة تمثيلية معروفة بإحياء كلاسيكيات المسرح المصري وتقديم أعمال تأليفية جديدة.",
    imageUrl: null,
    foundedYear: 1999,
    city: "الإسكندرية",
    createdAt: new Date("1999-01-01"),
  },
]

const mockEvents: EventWithRelations[] = [
  {
    id: 1,
    slug: "night-at-the-qahwa",
    title: "ليلة في القهوة",
    tagline: "كوميديا عن حيوات تُتنصَّت فوق طاولة واحدة في قلب وسط البلد.",
    description:
      "غرباء يجتمعون حول طاولة وراديو قديم وليلة واحدة لا تنتهي. بيانات مؤقتة تُعرض وقت تعذُّر الوصول لقاعدة البيانات.",
    category: "كوميديا",
    language: "عربي",
    durationMinutes: 95,
    posterUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1600&q=80",
    startsAt: new Date("2026-10-12T19:00:00+02:00"),
    featured: true,
    status: "on_sale",
    trailerUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    hasGroupDiscount: true,
    hasInteractiveSeats: true,
    priceTiers: [
      { id: "orchestra", name: "أوركسترا", priceCents: 25000, color: "#c9a227", rows: [0, 1, 2, 3] },
      { id: "balcony", name: "بلكونة", priceCents: 15000, color: "#6b7280", rows: [4, 5, 6, 7] },
    ],
    troupe: {
      id: 1,
      name: "مسرح الحر المستقل",
      slug: "al-masrah-al-hur",
      bio: mockTroupes[0].bio,
      city: "القاهرة",
    },
    venue: {
      id: 1,
      name: "مسرح الهوسابير",
      slug: "hanager-arts-centre",
      city: "القاهرة",
      address: "أرض أوبرا الروضي، الزمالك",
      googleMapsUrl: "https://maps.google.com/?q=Hanager+Arts+Centre+Cairo",
      rows: 8,
      seatsPerRow: 12,
    },
  },
  {
    id: 2,
    slug: "the-last-tram",
    title: "آخر ترام",
    tagline: "مسرحية ذكرى على كورنيش الإسكندرية.",
    description:
      "أخوان ينتظران ترامًا قد لا يأتي أبدًا. بيانات مؤقتة تُعرض وقت تعذُّر الوصول لقاعدة البيانات.",
    category: "دراما",
    language: "عربي",
    durationMinutes: 110,
    posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    heroUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80",
    startsAt: new Date("2026-11-02T20:00:00+02:00"),
    featured: true,
    status: "on_sale",
    trailerUrl: null,
    hasGroupDiscount: false,
    hasInteractiveSeats: false,
    priceTiers: [
      { id: "stalls", name: "بارتر", priceCents: 30000, color: "#c9a227", rows: [0, 1, 2, 3] },
      { id: "circle", name: "صف أول بلكونة", priceCents: 18000, color: "#6b7280", rows: [4, 5, 6, 7] },
    ],
    troupe: {
      id: 2,
      name: "فرقة بيت الحكمة",
      slug: "bayt-al-hikma",
      bio: mockTroupes[1].bio,
      city: "الإسكندرية",
    },
    venue: {
      id: 2,
      name: "مسرح سيد درويش",
      slug: "sayed-darwish-theatre",
      city: "الإسكندرية",
      address: "شارع فؤاد، وسط البلد",
      googleMapsUrl: null,
      rows: 8,
      seatsPerRow: 12,
    },
  },
]

function mapRow(row: any): EventWithRelations {
  return {
    id: row.event.id,
    slug: row.event.slug,
    title: row.event.title,
    tagline: row.event.tagline,
    description: row.event.description,
    category: row.event.category,
    language: row.event.language,
    durationMinutes: row.event.durationMinutes,
    posterUrl: row.event.posterUrl,
    heroUrl: row.event.heroUrl,
    startsAt: row.event.startsAt,
    featured: row.event.featured,
    status: row.event.status,
    trailerUrl: row.event.trailerUrl ?? null,
    hasGroupDiscount: row.event.hasGroupDiscount ?? false,
    hasInteractiveSeats: row.event.hasInteractiveSeats ?? false,
    priceTiers: row.event.priceTiers ?? [],
    troupe: {
      id: row.troupe.id,
      name: row.troupe.name,
      slug: row.troupe.slug,
      bio: row.troupe.bio,
      city: row.troupe.city,
    },
    venue: {
      id: row.venue.id,
      name: row.venue.name,
      slug: row.venue.slug,
      city: row.venue.city,
      address: row.venue.address,
      googleMapsUrl: row.venue.googleMapsUrl ?? null,
      rows: row.venue.rows,
      seatsPerRow: row.venue.seatsPerRow,
    },
  }
}

/**
 * عدد المقاعد المباعة لكل عرض (مجمّعة) — تُستخدم في شريط الإشغال بكروت العروض
 * وفي صفحة العرض. تعيد خريطة فارغة عند غياب قاعدة البيانات.
 */
export async function getSoldSeatCounts(eventIds: number[]): Promise<Map<number, number>> {
  if (eventIds.length === 0) return new Map()
  return withDbFallback(
    async () => {
      const rows = await db
        .select({ eventId: bookedSeats.eventId, seatId: bookedSeats.seatId })
        .from(bookedSeats)
      const counts = new Map<number, number>()
      for (const row of rows) {
        if (!eventIds.includes(row.eventId)) continue
        counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1)
      }
      return counts
    },
    new Map<number, number>(),
  )
}

/** كل المسارح المسجّلة (مع رابط الخريطة) — لاستخدامها في لوحة مدير المسرح والصفحة الرئيسية. */
export const getVenues = cache(async function getVenues() {
  return withDbFallback(
    () => db.select().from(venues).orderBy(asc(venues.name)),
    [] as (typeof venues.$inferSelect)[],
  )
})

async function withDbFallback<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  if (!getConnectionString()) {
    return fallback
  }

  try {
    return await query()
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown database error"
    console.warn("[queries] Database unavailable, using mock data:", message)
    return fallback
  }
}

/* ---------- عروض الفرق المنشورة عبر «مساحة العمل» (Supabase) ---------- */

/**
 * معرّف رقمي ثابت للعرض المنشور من مساحة العمل (سالب حتى لا يتعارض مع
 * معرّفات قاعدة العروض الأساسية) — يُستخدم في روابط الحجز وحساب المقاعد.
 */
function catalogueIdFor(slug: string): number {
  let hash = 0
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) % 2_000_000_000
  }
  return -1 - hash
}

type PublishedTier = { id?: string; name?: string; priceEgp?: number; color?: string; rows?: number[] }

/** يحوّل صف «عمل مسرحي منشور» في Supabase إلى شكل عرض الكتالوج العام. */
function publishedRowToEvent(row: Record<string, unknown>): EventWithRelations | null {
  const slug =
    (typeof row.event_slug === "string" && row.event_slug.trim().length > 0 ? row.event_slug.trim() : "") ||
    `prod-${String(row.id ?? "").slice(0, 8)}`

  const showtimes = Array.isArray(row.showtimes)
    ? (row.showtimes as unknown[]).filter((value): value is string => typeof value === "string")
    : []
  const startsAtRaw = (typeof row.starts_at === "string" && row.starts_at) || showtimes[0] || ""
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) return null

  const tiers = Array.isArray(row.tiers) ? (row.tiers as PublishedTier[]) : []
  if (tiers.length === 0) return null

  const numbered = String(row.seating_mode ?? "numbered") !== "general_admission"
  const rows = Math.max(1, Number(row.rows) || 8)
  const seatsPerRow = Math.max(1, Number(row.seats_per_row) || 12)
  const poster = typeof row.poster_url === "string" && row.poster_url.length > 0 ? row.poster_url : null

  return {
    id: catalogueIdFor(slug),
    slug,
    title: String(row.title ?? ""),
    tagline: "",
    description: "",
    category: "Drama",
    language: "Arabic",
    durationMinutes: 90,
    posterUrl: poster,
    heroUrl: poster,
    startsAt,
    featured: false,
    status: String(row.status ?? "on_sale"),
    trailerUrl: null,
    hasGroupDiscount: false,
    hasInteractiveSeats: numbered,
    priceTiers: tiers.map((tier, index) => ({
      id: String(tier.id ?? `tier-${index}`),
      name: String(tier.name ?? `فئة ${index + 1}`),
      priceCents: Math.max(0, Math.round(Number(tier.priceEgp ?? 0) * 100)),
      color: String(tier.color ?? "#f59e0b"),
      rows: Array.isArray(tier.rows)
        ? tier.rows.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [],
    })),
    troupe: { id: 0, name: String(row.owner_email ?? "فرقة كواليس"), slug: "troupe-kawalees", bio: "", city: null },
    venue: {
      id: 0,
      name: String(row.venue_name ?? "يُحدَّد لاحقًا"),
      slug: "venue-custom",
      city: String(row.venue_city ?? ""),
      address: "",
      googleMapsUrl: null,
      rows,
      seatsPerRow,
    },
  }
}

/** يقرأ العروض المنشورة (الحالة «معروض للبيع») من مساحة عمل الفرق على Supabase. */
async function publishedProductionsAsEvents(): Promise<EventWithRelations[]> {
  const admin = getSupabaseAdmin()
  if (!admin) return []
  try {
    const { data, error } = await admin
      .from("productions")
      .select(
        "id, owner_email, title, poster_url, status, venue_name, venue_city, seating_mode, rows, seats_per_row, capacity, tiers, starts_at, showtimes, event_slug",
      )
      .eq("status", "on_sale")
    if (error || !data) return []
    return data
      .map((row) => publishedRowToEvent(row as Record<string, unknown>))
      .filter((event): event is EventWithRelations => event !== null)
  } catch (error) {
    console.warn("[queries] published productions skipped:", error instanceof Error ? error.message : error)
    return []
  }
}

/** دمج عروض الفرق المنشورة مع كتالوج العروض (بلا تكرار بنفس الرابط) وترتيبها زمنيًا. */
async function withPublishedProductions(base: EventWithRelations[]): Promise<EventWithRelations[]> {
  const extra = await publishedProductionsAsEvents()
  if (extra.length === 0) return base
  const seen = new Set(base.map((event) => event.slug))
  const merged = [...base, ...extra.filter((event) => !seen.has(event.slug))]
  return merged.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

/** مُغلَّف بـ `cache()` حتى لا يتكرر الاستعلام بين الهيدر والصفحة في نفس الطلب. */
export const getEvents = cache(async function getEvents(): Promise<EventWithRelations[]> {
  const base = await withDbFallback(async () => {
    const rows = await db
      .select({ event: events, troupe: troupes, venue: venues })
      .from(events)
      .innerJoin(troupes, eq(events.troupeId, troupes.id))
      .innerJoin(venues, eq(events.venueId, venues.id))
      .orderBy(asc(events.startsAt))
    return rows.map(mapRow)
  }, mockEvents)

  // عروض الفرق التي نُشرت من «مساحة العمل» تظهر للجمهور فورًا في «العروض القادمة».
  return withPublishedProductions(base)
})

export async function getFeaturedEvents(): Promise<EventWithRelations[]> {
  return withDbFallback(async () => {
    const rows = await db
      .select({ event: events, troupe: troupes, venue: venues })
      .from(events)
      .innerJoin(troupes, eq(events.troupeId, troupes.id))
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(eq(events.featured, true))
      .orderBy(asc(events.startsAt))
    return rows.map(mapRow)
  }, mockEvents.filter((event) => event.featured))
}

/**
 * يُغلف بـ `cache()` من React كي تُنفَّذ الاستعلام مرة واحدة فقط لكل طلب
 * حتى لو استُدعيت الدالة من `generateMetadata` ومن الصفحة معًا.
 */
export const getEventBySlug = cache(async function getEventBySlug(
  slug: string,
): Promise<EventWithRelations | null> {
  const base = await withDbFallback(async () => {
    const rows = await db
      .select({ event: events, troupe: troupes, venue: venues })
      .from(events)
      .innerJoin(troupes, eq(events.troupeId, troupes.id))
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(eq(events.slug, slug))
      .limit(1)
    if (rows.length === 0) return null
    return mapRow(rows[0])
  }, mockEvents.find((event) => event.slug === slug) ?? null)

  if (base) return base

  // صفحة العرض تعمل أيضًا للعروض المنشورة من مساحة عمل الفرق (Supabase).
  const published = await publishedProductionsAsEvents()
  return published.find((event) => event.slug === slug) ?? null
})

export async function getEventById(id: number): Promise<EventWithRelations | null> {
  return withDbFallback(async () => {
    const rows = await db
      .select({ event: events, troupe: troupes, venue: venues })
      .from(events)
      .innerJoin(troupes, eq(events.troupeId, troupes.id))
      .innerJoin(venues, eq(events.venueId, venues.id))
      .where(eq(events.id, id))
      .limit(1)
    if (rows.length === 0) return null
    return mapRow(rows[0])
  }, mockEvents.find((event) => event.id === id) ?? null)
}

export async function getBookedSeatIds(eventId: number): Promise<string[]> {
  return withDbFallback(async () => {
    const rows = await db
      .select({ seatId: bookedSeats.seatId })
      .from(bookedSeats)
      .where(eq(bookedSeats.eventId, eventId))
    return rows.map((r) => r.seatId)
  }, [])
}

export async function getBookingByReference(reference: string) {
  return withDbFallback(async () => {
    const rows = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1)
    return rows[0] ?? null
  }, null)
}

/** مُغلَّف بـ `cache()` حتى لا يتكرر الاستعلام بين الهيدر والصفحة في نفس الطلب. */
export const getTroupes = cache(async function getTroupes() {
  return withDbFallback(
    () => db.select().from(troupes).orderBy(asc(troupes.name)),
    mockTroupes,
  )
})

/** مُغلَّف بـ `cache()` حتى لا يتكرر الاستعلام بين الهيدر والصفحة في نفس الطلب. */
export const getCategories = cache(async function getCategories(): Promise<string[]> {
  return withDbFallback(async () => {
    const rows = await db.selectDistinct({ category: events.category }).from(events)
    return rows.map((r) => r.category).sort()
  }, Array.from(new Set(mockEvents.map((event) => event.category))).sort())
})
