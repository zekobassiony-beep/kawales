import { db, getConnectionString } from "@/lib/db"
import { bookings, events } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { calculateTotals } from "@/lib/pricing"
import { getEvents, getTroupes } from "@/lib/queries"

/** ملخص محفظة الفرقة محسوب من حجوزات Neon الحقيقية. */
export type TroupeWallet = {
  grossCents: number
  ticketsSold: number
  bookingsCount: number
  platformFeeCents: number
  netCents: number
}

export async function getTroupeWallet(troupeId: number): Promise<TroupeWallet> {
  const empty: TroupeWallet = {
    grossCents: 0,
    ticketsSold: 0,
    bookingsCount: 0,
    platformFeeCents: 0,
    netCents: 0,
  }
  if (!getConnectionString()) return empty
  try {
    const rows = await db
      .select({ seats: bookings.seats, totalCents: bookings.totalCents, status: bookings.status })
      .from(bookings)
      .innerJoin(events, eq(bookings.eventId, events.id))
      .where(eq(events.troupeId, troupeId))
    const confirmed = rows.filter((row) => row.status === "confirmed")
    let gross = 0
    let tickets = 0
    let fee = 0
    for (const row of confirmed) {
      const seats = Array.isArray(row.seats) ? row.seats : []
      gross += row.totalCents
      tickets += seats.length
      fee += calculateTotals(seats.map((seat) => seat.priceCents)).serviceFeeCents
    }
    return {
      grossCents: gross,
      ticketsSold: tickets,
      bookingsCount: confirmed.length,
      platformFeeCents: fee,
      netCents: gross - fee,
    }
  } catch (error) {
    console.warn("[dashboards] wallet fallback:", error instanceof Error ? error.message : error)
    return empty
  }
}

export async function getTroupeShows(troupeId: number) {
  const all = await getEvents()
  return all.filter((event) => event.troupe.id === troupeId)
}

export async function getDefaultTroupe() {
  const troupes = await getTroupes()
  return troupes[0] ?? null
}

/* ---------- بيانات وهمية للأودشنات ---------- */

export type AuditionStatus = "open" | "closed"
export type ApplicationStatus = "pending" | "accepted" | "rejected"

export type CastingApplication = {
  id: string
  actorName: string
  phone: string
  role: string
  experience: string
  status: ApplicationStatus
}

export type Audition = {
  id: string
  title: string
  troupe: string
  role: string
  venue: string
  date: string
  pay: string
  status: AuditionStatus
  applicants: number
}

export const mockAuditions: Audition[] = [
  {
    id: "aud-1",
    title: "أودشن مسرحية «ليلة في القهوة» — دور النادل",
    troupe: "مسرح الحر المستقل",
    role: "النادل",
    venue: "مسرح الهوسابير",
    date: "السبت 4 أكتوبر 2026 — 6 مساءً",
    pay: "أجر 3000 ج.م للعرض",
    status: "open",
    applicants: 3,
  },
  {
    id: "aud-2",
    title: "أودشن «حكاية الظل» — دور الحكواتي",
    troupe: "فرقة مسرح الفنون الشعبية",
    role: "الحكواتي",
    venue: "ساقية الصاوي",
    date: "الأحد 12 أكتوبر 2026 — 5 مساءً",
    pay: "أجر 2500 ج.م للعرض",
    status: "open",
    applicants: 2,
  },
]

export const mockApplications: CastingApplication[] = [
  { id: "app-1", actorName: "كريم عادل", phone: "01012345678", role: "النادل", experience: "3 سنوات مسرح جامعي", status: "pending" },
  { id: "app-2", actorName: "منى فاروق", phone: "01123456789", role: "النادل", experience: "مسرحية «البنات» 2024", status: "pending" },
  { id: "app-3", actorName: "سامح رضوان", phone: "01234567890", role: "الحكواتي", experience: "حكواتي ساقية الصاوي", status: "accepted" },
]

/* ---------- بيانات وهمية للممثل ---------- */

export type ActorProfile = {
  name: string
  city: string
  phone: string
  bio: string
  skills: string[]
  gallery: { label: string; image: string }[]
}

export const mockActorProfile: ActorProfile = {
  name: "كريم عادل",
  city: "القاهرة",
  phone: "01012345678",
  bio: "ممثل مسرحي بخبرة 5 سنوات بين المسرح الجامعي والفرق المستقلة. متخصص في الكوميديا والمونودراما.",
  skills: ["تمثيل كوميدي", "إلقاء شعري", "غناء", "ارتجال"],
  gallery: [
    { label: "مسرحية «البنات»", image: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=600&q=80" },
    { label: "مونودراما «القهوة»", image: "https://images.unsplash.com/photo-1503095396549-8075f6b16a5b?auto=format&fit=crop&w=600&q=80" },
    { label: "ورشة صوتية", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80" },
  ],
}

export type ActorApplication = {
  id: string
  auditionTitle: string
  troupe: string
  appliedAt: string
  status: ApplicationStatus
}

export const mockActorApplications: ActorApplication[] = [
  { id: "aa-1", auditionTitle: "دور النادل — «ليلة في القهوة»", troupe: "مسرح الحر المستقل", appliedAt: "20 سبتمبر 2026", status: "pending" },
  { id: "aa-2", auditionTitle: "دور الحكواتي — «حكاية الظل»", troupe: "فرقة مسرح الفنون الشعبية", appliedAt: "15 سبتمبر 2026", status: "accepted" },
  { id: "aa-3", auditionTitle: "كورس غنائي — «ليالي الأندلس»", troupe: "فرقة البرواز", appliedAt: "2 سبتمبر 2026", status: "rejected" },
]

/* ---------- بيانات وهمية لمدير المسرح ---------- */

export type VenueShow = {
  id: string
  title: string
  troupe: string
  date: string
  time: string
  seats: number
}

export const mockVenueSchedule: VenueShow[] = [
  { id: "vs-1", title: "ليلة في القهوة", troupe: "مسرح الحر المستقل", date: "12 أكتوبر 2026", time: "7 مساءً", seats: 96 },
  { id: "vs-2", title: "غرفة 204", troupe: "مجموعة ستوديو المسرح", date: "24 أكتوبر 2026", time: "9 مساءً", seats: 96 },
  { id: "vs-3", title: "ليالي الأندلس", troupe: "فرقة البرواز", date: "5 أكتوبر 2026", time: "7:30 مساءً", seats: 96 },
]

export type OffPeakDeal = {
  id: string
  days: string
  discount: string
  active: boolean
}

export const mockOffPeakDeals: OffPeakDeal[] = [
  { id: "op-1", days: "الأحد – الثلاثاء", discount: "خصم 20% على البلكونة", active: true },
  { id: "op-2", days: "حفلات الماتينيه (قبل 5 مساءً)", discount: "خصم 15% على كل الفئات", active: false },
]

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  rejected: "غير مقبول",
}