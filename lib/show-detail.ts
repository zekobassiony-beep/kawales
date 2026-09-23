/**
 * مساعدات صفحة العرض وكروت العروض (وحدة **نقية** قابلة للاختبار):
 * فئات التذاكر المعدنية، التصنيف العمري، رابط الخريطة، الإشغال، خصم الشلة،
 * توزيع النجوم، وقائمة الممثلين.
 */

export type MetalTier = {
  /** الاسم المعروض (دايموند / ذهبي / فضي / برونزي). */
  label: string
  /** شارة ملونة للكارت. */
  badgeClass: string
  /** نقطة لونية صغيرة. */
  dotClass: string
  /** توهج الكارت عند الاختيار. */
  glowClass: string
}

const METALS: MetalTier[] = [
  {
    label: "دايموند",
    badgeClass: "border-sky-400/50 bg-sky-500/15 text-sky-300",
    dotClass: "bg-sky-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.9)]",
    glowClass: "shadow-[0_0_34px_-12px_rgba(56,189,248,0.95)] border-sky-400/60",
  },
  {
    label: "ذهبي",
    badgeClass: "border-amber-500/50 bg-amber-500/15 text-amber-300",
    dotClass: "bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.9)]",
    glowClass: "shadow-[0_0_34px_-12px_rgba(251,191,36,0.95)] border-amber-500/60",
  },
  {
    label: "فضي",
    badgeClass: "border-zinc-400/50 bg-zinc-400/15 text-zinc-200",
    dotClass: "bg-zinc-300 shadow-[0_0_12px_2px_rgba(212,212,216,0.8)]",
    glowClass: "shadow-[0_0_34px_-12px_rgba(212,212,216,0.9)] border-zinc-400/60",
  },
  {
    label: "برونزي",
    badgeClass: "border-orange-600/50 bg-orange-600/15 text-orange-300",
    dotClass: "bg-orange-500 shadow-[0_0_12px_2px_rgba(249,115,22,0.85)]",
    glowClass: "shadow-[0_0_34px_-12px_rgba(249,115,22,0.9)] border-orange-600/60",
  },
]

/** الفئة المعدنية لكارت تذكرة حسب ترتيبه (أغلى فئة = دايموند). */
export function metalForTier(_name: string, index: number): MetalTier {
  return METALS[Math.min(index, METALS.length - 1)]
}

/** التصنيف العمري المشتق من فئة العرض ومدته (لا يوجد حقل في قاعدة البيانات). */
export function ageRatingFor(input: { category: string; durationMinutes: number }): string {
  const category = (input.category ?? "").trim()
  if (/أطفال|طفل|kids/i.test(category)) return "عائلي"
  if (/رعب|إثارة|جريمة|تشويق/i.test(category)) return "+16"
  if (input.durationMinutes >= 120) return "+16"
  return "+12"
}

/** رابط الخريطة: رابط المسرح المحفوظ، أو بحث Google Maps تلقائي من الاسم والعنوان. */
export function mapsUrlFor(venue: {
  googleMapsUrl?: string | null
  name: string
  address?: string
  city?: string
}): string {
  const stored = (venue.googleMapsUrl ?? "").trim()
  if (stored.length > 0) return stored
  const query = [venue.name, venue.address, venue.city].filter(Boolean).join("، ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export type OccupancyStatus = "available" | "trending" | "limited" | "sold_out"

/** الشكل الأدنى لفئة تذكرة تعرضها الواجهة. */
export type BookingTierLike = {
  id: string
  name: string
  priceCents: number
  color: string
}

export type OccupancyInfo = {
  pct: number
  remaining: number
  status: OccupancyStatus
  label: string
  barClass: string
}

/** حالة الإشغال + المقاعد المتبقية + صنف شريط التقدم. */
export function occupancyInfo(sold: number, capacity: number): OccupancyInfo {
  const safeCapacity = Math.max(1, capacity)
  const safeSold = Math.max(0, Math.min(sold, safeCapacity))
  const pct = Math.round((safeSold / safeCapacity) * 100)
  const remaining = Math.max(0, safeCapacity - safeSold)

  if (remaining === 0) {
    return { pct: 100, remaining: 0, status: "sold_out", label: "مباع", barClass: "bg-red-500 shadow-[0_0_16px_-2px_rgba(239,68,68,0.95)]" }
  }
  if (pct >= 85) {
    return { pct, remaining, status: "limited", label: "أماكن محدودة", barClass: "bg-amber-500 shadow-[0_0_16px_-2px_rgba(245,158,11,0.9)]" }
  }
  if (pct >= 55) {
    return { pct, remaining, status: "trending", label: "رائج", barClass: "bg-amber-400 shadow-[0_0_16px_-2px_rgba(251,191,36,0.85)]" }
  }
  return { pct, remaining, status: "available", label: "متاح", barClass: "bg-emerald-500 shadow-[0_0_16px_-2px_rgba(16,185,129,0.85)]" }
}

/** خصم الشلة: 15% عند حجز 5 تذاكر أو أكثر. */
export function groupDiscount(quantity: number, unitCents: number): { pct: number; savingsCents: number; totalCents: number } {
  const qty = Math.max(1, Math.floor(quantity))
  const pct = qty >= 5 ? 15 : 0
  const gross = qty * Math.max(0, unitCents)
  const savingsCents = Math.round((gross * pct) / 100)
  return { pct, savingsCents, totalCents: gross - savingsCents }
}

/** توزيع النجوم (5 → 1) من قائمة تقييمات رقمية. */
export function starDistribution(ratings: number[]): { stars: number; count: number; pct: number }[] {
  const total = ratings.length
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.filter((rating) => Math.round(rating) === stars).length
    return { stars, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }
  })
}

export type CastRoleKind = "lead" | "supporting"

export type CastMember = {
  name: string
  role: string
  kind: CastRoleKind
  /** أول حرف لعرضه في صورة رمزية عند غياب الصورة. */
  initial: string
}

const ROLE_POOL: { role: string; kind: CastRoleKind }[] = [
  { role: "البطل", kind: "lead" },
  { role: "البطلة", kind: "lead" },
  { role: "المخرج", kind: "supporting" },
  { role: "الصديق", kind: "supporting" },
  { role: "الراوي", kind: "supporting" },
  { role: "الخصم", kind: "lead" },
  { role: "الموسيقي", kind: "supporting" },
  { role: "مصمم الإضاءة", kind: "supporting" },
]

const NAME_POOL = [
  "كريم عادل",
  "سلمى منصور",
  "يوسف الشاذلي",
  "نهى بركات",
  "أحمد زكي",
  "مي حسن",
  "طارق فهمي",
  "دينا سعيد",
]

/** بصمة صغيرة حتمية من نص (لاختيار أسماء ثابتة لكل عرض). */
function hashText(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

/**
 * قائمة الممثلين: تُبنى من طاقم العمل الحقيقي (المقبول) في مساحة عمل الفرقة،
 * ومع غيابه نولّد قائمة ثابتة (حتمية لكل عرض) حتى لا يفرغ التبويب.
 */
export function castRoster(input: {
  seed: string
  crew?: { name: string; part: string; status: string }[]
}): CastMember[] {
  const accepted = (input.crew ?? []).filter((member) => member.status === "accepted" && member.name.trim().length > 0)
  if (accepted.length > 0) {
    return accepted.map((member, index) => ({
      name: member.name.trim(),
      role: member.part?.trim() || ROLE_POOL[index % ROLE_POOL.length].role,
      kind: index < Math.ceil(accepted.length / 2) ? "lead" : "supporting",
      initial: member.name.trim().charAt(0),
    }))
  }

  const seed = hashText(input.seed)
  return ROLE_POOL.map((entry, index) => {
    const name = NAME_POOL[(seed + index * 3) % NAME_POOL.length]
    return { name, role: entry.role, kind: entry.kind, initial: name.charAt(0) }
  })
}

export type ShowtimeCard = {
  id: number
  slug: string
  dateLabel: string
  timeLabel: string
  status: "available" | "sold_out"
  statusLabel: string
  isCurrent: boolean
}

/** يبني بطاقات المواعيد الأفقية (مواعيد نفس الفرقة) مع حالة كل موعد. */
export function buildShowtimeCards(
  events: { id: number; slug: string; startsAt: Date | string; sold: number; capacity: number }[],
  currentId: number,
  formatDate: (date: Date | string) => string,
  formatTime: (date: Date | string) => string,
): ShowtimeCard[] {
  return [...events]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((event) => {
      const { remaining } = occupancyInfo(event.sold, event.capacity)
      const soldOut = remaining === 0
      return {
        id: event.id,
        slug: event.slug,
        dateLabel: formatDate(event.startsAt),
        timeLabel: formatTime(event.startsAt),
        status: soldOut ? "sold_out" : "available",
        statusLabel: soldOut ? "مباع" : "متاح",
        isCurrent: event.id === currentId,
      }
    })
}

