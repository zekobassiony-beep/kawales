"use client"

import { useSyncExternalStore } from "react"
import { getTicketsForUser, readTickets, type Ticket } from "@/lib/tickets"

/**
 * مكتبة التقييمات الموثقة (Verified Reviews).
 *
 * التقييم مسموح **فقط** لمن حضر العرض فعلًا: أي صاحب تذكرة حالتها
 * `checked_in` لنفس العرض. التخزين محلي (نفس أسلوب باقي اللوحات: محاكاة ثم
 * ربط حقيقي بقاعدة البيانات) ويُقرأ عبر `useReviews()`.
 */

export type VerifiedReview = {
  id: string
  showId: string
  /** معرف صاحب التقييم (البريد الإلكتروني). */
  userId: string
  userName: string
  /** من 1 إلى 5 نجوم. */
  rating: number
  comment: string
  /** موثّق دائمًا — لا يُقبل التقييم بغير حضور مُسجَّل عند البوابة. */
  verified: boolean
  /** كود التذكرة التي سُجّل بها الحضور. */
  ticketId: string
  createdAt: string
}

export const REVIEWS_STORAGE_KEY = "kawalees:reviews"
export const REVIEWS_CHANGE_EVENT = "kawalees:reviews-change"

export const VERIFIED_BADGE_LABEL = "جمهور موثق — حضر العرض 🏅"

export const REVIEWS_LOCKED_NOTICE = "يمكنك تقييم هذا العرض فقط بعد الحضور ومسح تذكرتك عند البوابة 🎭"

/** تقييمات استرشادية للعرض التجريبي قبل تراكم تقييمات الجمهور الحقيقي. */
export const DEMO_REVIEWS: VerifiedReview[] = [
  {
    id: "rev-demo-1",
    showId: "1",
    userId: "demo-audience-1@kawalees.test",
    userName: "سلمى عبد الرحمن",
    rating: 5,
    comment: "تصميم الإضاءة والموسيقى الحية صنعا فرقًا كبيرًا — تجربة مسرحية كاملة من أول دقيقة.",
    verified: true,
    ticketId: "KW-DEMO01",
    createdAt: "2026-09-12T19:20:00.000Z",
  },
  {
    id: "rev-demo-2",
    showId: "1",
    userId: "demo-audience-2@kawalees.test",
    userName: "يوسف الجندي",
    rating: 4,
    comment: "الأداء التمثيلي ممتاز، وأتمنى فقط زيادة عدد عروض الأسبوع لأن التذاكر تنفد سريعًا.",
    verified: true,
    ticketId: "KW-DEMO02",
    createdAt: "2026-09-14T21:05:00.000Z",
  },
  {
    id: "rev-demo-3",
    showId: "2",
    userId: "demo-audience-3@kawalees.test",
    userName: "نهى مصطفى",
    rating: 5,
    comment: "النص جريء والمعالجة الإخراجية ذكية — خرجت من المسرح وأنا أفكر في النهاية كثيرًا.",
    verified: true,
    ticketId: "KW-DEMO03",
    createdAt: "2026-09-15T20:40:00.000Z",
  },
]

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parseReviews(raw: string | null): VerifiedReview[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as VerifiedReview[]).filter((review) => review && typeof review.id === "string")
  } catch {
    return []
  }
}

let cachedRaw: string | null | undefined
let cachedReviews: VerifiedReview[] = []

/** تقييمات المستخدمين المحفوظة محليًا (وعلى السيرفر: قائمة فارغة). */
export function readReviews(): VerifiedReview[] {
  if (typeof window === "undefined") return []
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedReviews = parseReviews(raw)
  }
  return cachedReviews
}

function persistReviews(reviews: VerifiedReview[]): void {
  if (typeof window === "undefined") return
  cachedReviews = reviews
  const raw = JSON.stringify(reviews)
  try {
    window.localStorage.setItem(REVIEWS_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(REVIEWS_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(REVIEWS_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(REVIEWS_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): VerifiedReview[] => []

/** كل التقييمات الحيّة — متزامنة بين صفحة العرض ولوحة العميل. */
export function useReviews(): VerifiedReview[] {
  return useSyncExternalStore(subscribe, readReviews, getServerSnapshot)
}

/* ---------- منطق التقييم الموثق ---------- */

/** التذكرة التي سُجّل بها حضور المستخدم لهذا العرض (أو `null`). */
export function checkedInTicketFor(userId: string, showId: string, source?: Ticket[]): Ticket | null {
  const email = userId.trim().toLowerCase()
  if (email.length === 0) return null
  const tickets = source ?? getTicketsForUser(email)
  return (
    tickets.find((ticket) => ticket.showId === String(showId) && ticket.status === "checked_in") ?? null
  )
}

/**
 * هل يحق للمستخدم تقييم هذا العرض؟
 * ترجع `true` **فقط** إذا كان لديه تذكرة بحالة `checked_in` لنفس العرض.
 * تُقبل قائمة تذاكر جاهزة (من `useTickets()`) لتفادي قراءة التخزين أثناء العرض.
 */
export function canUserReviewShow(userId: string, showId: string, source?: Ticket[]): boolean {
  return checkedInTicketFor(userId, showId, source) !== null
}

/** هل سبق للمستخدم تقييم هذا العرض؟ */
export function hasUserReviewed(userId: string, showId: string, source?: VerifiedReview[]): boolean {
  const email = userId.trim().toLowerCase()
  const reviews = source ?? readReviews()
  return reviews.some((review) => review.userId === email && review.showId === String(showId))
}

export type ReviewInput = {
  userId: string
  userName: string
  showId: string
  rating: number
  comment: string
}

export type ReviewSubmitResult = { ok: boolean; message: string; review: VerifiedReview | null }

/**
 * إضافة/تحديث تقييم موثق. ترفض التقييم بلا حضور مُسجَّل عند البوابة،
 * وتربط التقييم بكود التذكرة التي حضر بها صاحبها.
 */
export function addReview(input: ReviewInput): ReviewSubmitResult {
  const userId = input.userId.trim().toLowerCase()
  const showId = String(input.showId)
  const ticket = checkedInTicketFor(userId, showId)

  if (!ticket) {
    return { ok: false, message: REVIEWS_LOCKED_NOTICE, review: null }
  }

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)))
  if (!Number.isFinite(rating) || rating < 1) {
    return { ok: false, message: "اختر عدد النجوم أولًا.", review: null }
  }
  if (input.comment.trim().length < 5) {
    return { ok: false, message: "اكتب تعليقًا قصيرًا (5 أحرف على الأقل).", review: null }
  }

  const existing = readReviews().find((review) => review.userId === userId && review.showId === showId)
  const review: VerifiedReview = {
    id: existing?.id ?? `rev-${Math.random().toString(36).slice(2, 9)}`,
    showId,
    userId,
    userName: input.userName.trim() || "جمهور كواليس",
    rating,
    comment: input.comment.trim(),
    verified: true,
    ticketId: ticket.id,
    createdAt: new Date().toISOString(),
  }

  persistReviews([review, ...readReviews().filter((item) => item.userId !== userId || item.showId !== showId)])
  return {
    ok: true,
    message: existing
      ? "تم تحديث تقييمك الموثق — شكرًا لك 🏅"
      : "تم نشر تقييمك الموثق — شارة «جمهور موثق» ظاهرة بجوار اسمك 🏅",
    review,
  }
}

/** حذف تقييم المستخدم لعرض (يُستعمل من الواجهة عند الحاجة). */
export function removeReview(userId: string, showId: string): void {
  const email = userId.trim().toLowerCase()
  persistReviews(readReviews().filter((review) => !(review.userId === email && review.showId === String(showId))))
}

/** تقييمات عرض معيّن: تقييمات المستخدمين أولًا ثم الاسترشادية، مرتّبة بالأحدث. */
export function reviewsForShow(showId: string, source?: VerifiedReview[]): VerifiedReview[] {
  const id = String(showId)
  const all = source ?? readReviews()
  const stored = all.filter((review) => review.showId === id)
  const storedIds = new Set(stored.map((review) => review.id))
  const demo = DEMO_REVIEWS.filter((review) => review.showId === id && !storedIds.has(review.id))
  return [...stored, ...demo].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** متوسط التقييم (0 عند عدم وجود تقييمات). */
export function averageRating(showId: string, source?: VerifiedReview[]): number {
  const reviews = reviewsForShow(showId, source)
  if (reviews.length === 0) return 0
  const total = reviews.reduce((sum, review) => sum + review.rating, 0)
  return Math.round((total / reviews.length) * 10) / 10
}

/** عدد تقييمات عرض معيّن (بما فيها الاسترشادية). */
export function reviewCount(showId: string, source?: VerifiedReview[]): number {
  return reviewsForShow(showId, source).length
}

/** مجموع التقييمات الموثقة التي كتبها الجمهور (يُستعمل في كروت الإحصائيات). */
export function verifiedReviewCount(source?: VerifiedReview[]): number {
  return (source ?? readReviews()).length
}

/** عدد الحضور المسجّلين عند البوابة عبر كل التذاكر المحفوظة. */
export function checkedInCount(source?: Ticket[]): number {
  const tickets = source ?? readTickets()
  return tickets.filter((ticket) => ticket.status === "checked_in").length
}

