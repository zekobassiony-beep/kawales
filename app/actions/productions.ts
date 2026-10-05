"use server"

import { getSupabaseAdmin } from "@/lib/supabase/server"
import { getSupabaseUser } from "@/lib/supabase/session-server"
import type { Workspace, Production, Audition, AuditionApplication, Achievement, CrewMember } from "@/lib/productions"

/**
 * مساحة عمل الإنتاج على السيرفر (Supabase) — حفظ حقيقي بدل `localStorage`.
 *
 * - كل إجراء يتحقق من **جلسة Supabase الحقيقية** ثم يكتب بمفتاح الخدمة.
 * - الأودشنات والدعوات تصبح مشتركة: الفنانون يرون الأودشنات المفتوحة ويستلمون
 *   دعواتهم على أي جهاز، ولا تعتمد على متصفح واحد.
 * - غياب الجدول لا يُسقط الواجهة: نُعيد `tableReady: false` مع رسالة عربية تطلب
 *   تشغيل `scripts/productions-schema.sql` مرة واحدة.
 */

const TABLE_MISSING_MESSAGE =
  "جداول مساحة العمل غير موجودة على Supabase — شغّل الملف scripts/productions-schema.sql من SQL Editor مرة واحدة."

const PRODUCTION_KEYS = "id, owner_email, title, poster_url, status, venue_kind, venue_name, venue_city, seating_mode, rows, seats_per_row, blocked_seats, capacity, tiers, gallery, starts_at, showtimes, event_slug"
const AUDITION_KEYS = "id, owner_email, production_id, title, role, requirements, pay, venue, date_text, status"
const APPLICATION_KEYS = "id, audition_id, actor_email, actor_name, profile_url, status"

export type WorkspacePayload = {
  ok: boolean
  error?: string
  tableReady: boolean
  workspace: Workspace
}

export type MutationResult<T> = { ok: boolean; error?: string; data?: T }

/** هل الخطأ يعني أن الجداول غير موجودة؟ (دالة داخلية — ملف «use server» لا يصدّر إلا دوال async). */
function isTableMissing(message: string | undefined): boolean {
  return /does not exist|schema cache|relation|Could not find the table/i.test(message ?? "")
}

/** نص مُطبَّع بحد أقصى للطول (يحمي من الصفوف العملاقة). */
function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function rowToCrew(row: Record<string, unknown>): CrewMember {
  return {
    id: String(row.id ?? ""),
    name: text(row.name),
    email: text(row.email),
    part: text(row.part) || "طاقم",
    status: (text(row.status) || "invited") as CrewMember["status"],
    invitedAt: text(row.invited_at),
    respondedAt: row.responded_at ? text(row.responded_at) : undefined,
  }
}

function rowToProduction(row: Record<string, unknown>, crew: CrewMember[]): Production {
  return {
    id: String(row.id ?? ""),
    title: text(row.title),
    posterUrl: text(row.poster_url, 2_000_000),
    status: (text(row.status) || "coming_soon") as Production["status"],
    createdAt: text(row.created_at),
    venue: row.venue_name ? text(row.venue_name) : null,
    venueKind: (text(row.venue_kind) || "later") as NonNullable<Production["venueKind"]>,
    venueCity: row.venue_city ? text(row.venue_city) : null,
    tiers: asArray<Production["tiers"][number]>(row.tiers),
    seatingMode: (text(row.seating_mode) || "numbered") as Production["seatingMode"],
    rows: number(row.rows, 6, 1, 26),
    seatsPerRow: number(row.seats_per_row, 10, 1, 40),
    blockedSeats: asArray<string>(row.blocked_seats),
    capacity: number(row.capacity, 0, 0, 100_000),
    sold: 0,
    gallery: asArray<string>(row.gallery),
    crew,
    eventSlug: row.event_slug ? text(row.event_slug) : null,
    startsAt: row.starts_at ? text(row.starts_at) : null,
    showtimes: asArray<string>(row.showtimes),
    ownerEmail: text(row.owner_email),
  }
}

function rowToAudition(row: Record<string, unknown>): Audition {
  return {
    id: String(row.id ?? ""),
    productionId: row.production_id ? String(row.production_id) : null,
    title: text(row.title),
    role: text(row.role),
    requirements: text(row.requirements),
    pay: text(row.pay),
    venue: text(row.venue),
    date: text(row.date_text),
    status: (text(row.status) || "open") as Audition["status"],
    createdAt: text(row.created_at),
    ownerEmail: text(row.owner_email),
  }
}

function rowToApplication(row: Record<string, unknown>): AuditionApplication {
  return {
    id: String(row.id ?? ""),
    auditionId: String(row.audition_id ?? ""),
    actorName: text(row.actor_name),
    actorEmail: text(row.actor_email),
    profileUrl: text(row.profile_url, 2000),
    status: (text(row.status) || "pending") as AuditionApplication["status"],
    appliedAt: text(row.applied_at),
  }
}

function rowToAchievement(row: Record<string, unknown>): Achievement {
  return {
    id: String(row.id ?? ""),
    actorName: text(row.actor_name),
    actorEmail: text(row.actor_email),
    kind: (text(row.kind) || "workshop") as Achievement["kind"],
    title: text(row.title),
    organizer: text(row.organizer),
    year: text(row.year),
    link: text(row.link),
  }
}

const EMPTY_WORKSPACE: Workspace = { productions: [], auditions: [], applications: [], achievements: [] }

/** نتيجة موحّدة لغياب الجلسة/الإعداد. */
function notSignedIn(): { ok: false; error: string } {
  return { ok: false, error: "غير مصرّح — سجّل الدخول أولًا ثم أعد المحاولة." }
}

/**
 * يقرأ مساحة العمل كاملة للمستخدم الحالي:
 *  - أعماله المسرحية + الأعمال التي هو عضو طاقم فيها (بالدعوة).
 *  - أودشناته + الأودشنات المفتوحة من الفرق الأخرى (ليتقدّم إليها الفنانون).
 *  - طلباته + إنجازاته.
 */
export async function loadWorkspaceAction(): Promise<WorkspacePayload> {
  const user = await getSupabaseUser()
  const email = (user?.email ?? "").trim().toLowerCase()
  if (!user || !email) {
    return { ok: false, error: notSignedIn().error, tableReady: true, workspace: EMPTY_WORKSPACE }
  }

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر.", tableReady: false, workspace: EMPTY_WORKSPACE }

  // 1) صفوف الطاقم الخاصة بي (لأعرف الأعمال التي دُعيت إليها).
  const crewMine = await admin.from("crew_members").select("production_id").ilike("email", email)
  if (crewMine.error) {
    return {
      ok: false,
      error: isTableMissing(crewMine.error.message) ? TABLE_MISSING_MESSAGE : crewMine.error.message,
      tableReady: false,
      workspace: EMPTY_WORKSPACE,
    }
  }
  const invitedProductionIds = Array.from(
    new Set((crewMine.data ?? []).map((row) => String((row as { production_id?: string }).production_id ?? ""))),
  ).filter((id) => id.length > 0)

  // 2) الأعمال التي أملكها + التي دُعيت إليها.
  const ownedQuery = admin.from("productions").select(PRODUCTION_KEYS).ilike("owner_email", email)
  const invitedQuery =
    invitedProductionIds.length > 0
      ? admin.from("productions").select(PRODUCTION_KEYS).in("id", invitedProductionIds)
      : null
  const [owned, invited] = await Promise.all([ownedQuery, invitedQuery ?? Promise.resolve({ data: [], error: null })])
  if (owned.error) {
    return {
      ok: false,
      error: isTableMissing(owned.error.message) ? TABLE_MISSING_MESSAGE : owned.error.message,
      tableReady: false,
      workspace: EMPTY_WORKSPACE,
    }
  }

  const productionRows = [
    ...((owned.data ?? []) as Record<string, unknown>[]),
    ...((invited && !invited.error ? (invited.data ?? []) : []) as Record<string, unknown>[]),
  ]
  const productionIds = productionRows.map((row) => String(row.id ?? "")).filter(Boolean)

  // 3) طاقم كل عمل + أودشناتي + الأودشنات المفتوحة + طلباتي + إنجازاتي.
  const [crewResult, myAuditions, openAuditions, myApplications, achievements] = await Promise.all([
    productionIds.length > 0
      ? admin.from("crew_members").select("id, production_id, name, email, part, status, invited_at, responded_at").in("production_id", productionIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("auditions").select(AUDITION_KEYS).ilike("owner_email", email),
    admin.from("auditions").select(AUDITION_KEYS).eq("status", "open"),
    admin.from("audition_applications").select(APPLICATION_KEYS).ilike("actor_email", email),
    admin.from("achievements").select("id, actor_email, actor_name, kind, title, organizer, year, link").ilike("actor_email", email),
  ])

  const crewRows = (crewResult.data ?? []) as Record<string, unknown>[]
  const productions = productionRows.map((row) => {
    const id = String(row.id ?? "")
    const crew = crewRows.filter((member) => String(member.production_id ?? "") === id).map(rowToCrew)
    return rowToProduction(row, crew)
  })

  const auditionRows = [
    ...((myAuditions.data ?? []) as Record<string, unknown>[]),
    ...((openAuditions.data ?? []) as Record<string, unknown>[]),
  ]
  const seenAuditions = new Set<string>()
  const auditions = auditionRows
    .map(rowToAudition)
    .filter((audition) => (seenAuditions.has(audition.id) ? false : seenAuditions.add(audition.id) && true))

  const applications = ((myApplications.data ?? []) as Record<string, unknown>[]).map(rowToApplication)
  const achievementList = ((achievements.data ?? []) as Record<string, unknown>[]).map(rowToAchievement)

  return {
    ok: true,
    tableReady: true,
    workspace: { productions, auditions, applications, achievements: achievementList },
  }
}

/* ---------- التحويل من حقول الواجهة إلى أعمدة قاعدة البيانات ---------- */

function sanitizeTiers(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 12).map((tier) => {
    const source = (tier ?? {}) as Record<string, unknown>
    return {
      id: text(source.id, 40) || `tier-${Math.random().toString(36).slice(2, 8)}`,
      name: text(source.name, 60) || "فئة",
      priceEgp: number(source.priceEgp, 0, 0, 1_000_000),
      capacity: number(source.capacity, 0, 0, 100_000),
      color: text(source.color, 20) || "#f59e0b",
      rows: Array.isArray(source.rows) ? source.rows.map((row) => number(row, 0, 0, 25)).slice(0, 26) : [],
    }
  })
}

function patchToColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const columns: Record<string, unknown> = {}
  if (typeof patch.title === "string") columns.title = text(patch.title, 200)
  if (typeof patch.posterUrl === "string") columns.poster_url = text(patch.posterUrl, 2_000_000)
  if (typeof patch.status === "string") columns.status = text(patch.status, 20)
  if ("venue" in patch) columns.venue_name = patch.venue ? text(patch.venue, 200) : null
  if (typeof patch.venueKind === "string") columns.venue_kind = text(patch.venueKind, 20)
  if ("venueCity" in patch) columns.venue_city = patch.venueCity ? text(patch.venueCity, 120) : null
  if (Array.isArray(patch.tiers)) columns.tiers = sanitizeTiers(patch.tiers)
  if (typeof patch.seatingMode === "string") columns.seating_mode = text(patch.seatingMode, 24)
  if (patch.rows !== undefined) columns.rows = number(patch.rows, 6, 1, 26)
  if (patch.seatsPerRow !== undefined) columns.seats_per_row = number(patch.seatsPerRow, 10, 1, 40)
  if (Array.isArray(patch.blockedSeats)) {
    columns.blocked_seats = patch.blockedSeats.slice(0, 600).map((seat) => text(seat, 12))
  }
  if (patch.capacity !== undefined) columns.capacity = number(patch.capacity, 0, 0, 100_000)
  if (Array.isArray(patch.gallery)) columns.gallery = patch.gallery.slice(0, 24).map((image) => text(image, 2_000_000))
  if (typeof patch.startsAt === "string" && patch.startsAt.length > 0) columns.starts_at = patch.startsAt
  if (Array.isArray(patch.showtimes)) {
    columns.showtimes = patch.showtimes
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, 60)
  }
  if (typeof patch.eventSlug === "string") columns.event_slug = text(patch.eventSlug, 200) || null
  return columns
}

/** هل هذا العمل يملكه المستخدم الحالي؟ (حماية قبل أي تعديل) */
async function ownsProduction(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  productionId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.from("productions").select("owner_id").eq("id", productionId).maybeSingle()
  if (error || !data) return false
  return String((data as { owner_id?: string }).owner_id ?? "") === userId
}

/** ينشئ عملًا مسرحيًا جديدًا بحالة «قريبًا» (الخطوة الأولى من النموذج). */
export async function createProductionAction(input: {
  title: string
  posterUrl: string
}): Promise<MutationResult<Production>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const title = text(input.title, 200)
  if (title.length < 2) return { ok: false, error: "اسم العرض مطلوب (حرفان على الأقل)." }

  const { data, error } = await admin
    .from("productions")
    .insert({
      owner_id: user.id,
      owner_email: user.email.trim().toLowerCase(),
      title,
      poster_url: text(input.posterUrl, 2_000_000),
      status: "coming_soon",
    })
    .select(PRODUCTION_KEYS)
    .single()

  if (error) {
    console.warn(`[productions] create failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true, data: rowToProduction(data as Record<string, unknown>, []) }
}

/** يحدّث حقول العمل (المسرح، الفئات، نمط الحجز، المعرض، الحالة…). */
export async function updateProductionAction(
  productionId: string,
  patch: Record<string, unknown>,
): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }
  if (!(await ownsProduction(admin, productionId, user.id))) {
    return { ok: false, error: "لا تملك صلاحية تعديل هذا العمل." }
  }

  const columns = patchToColumns(patch ?? {})
  if (Object.keys(columns).length === 0) return { ok: true }

  const { error } = await admin.from("productions").update(columns).eq("id", productionId)
  if (error) {
    console.warn(`[productions] update failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true }
}

const CREW_KEYS = "id, production_id, name, email, part, status, invited_at, responded_at"

/** يدعو عضوًا لطاقم العمل (تصل الدعوة له ببريده على أي جهاز). */
export async function inviteCrewAction(input: {
  productionId: string
  name: string
  email: string
  part: string
}): Promise<MutationResult<CrewMember>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }
  if (!(await ownsProduction(admin, input.productionId, user.id))) {
    return { ok: false, error: "لا تملك صلاحية دعوة طاقم لهذا العمل." }
  }

  const email = text(input.email, 160).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "بريد العضو غير صحيح." }

  const payload = {
    name: text(input.name, 120) || email.split("@")[0],
    email,
    part: text(input.part, 60) || "طاقم",
    status: "invited",
    responded_at: null,
  }

  // upsert يدوي: الفهرس الفريد عندنا على (production_id, lower(email)) وهو تعبير
  // لا يقبله PostgREST كهدف onConflict، لذا نتحقق ثم نُحدّث أو نُدرج.
  const existing = await admin
    .from("crew_members")
    .select("id")
    .eq("production_id", input.productionId)
    .ilike("email", email)
    .maybeSingle()

  if (existing.error) {
    console.warn(`[productions] invite lookup failed: ${existing.error.message}`)
    return { ok: false, error: isTableMissing(existing.error.message) ? TABLE_MISSING_MESSAGE : existing.error.message }
  }

  const query = existing.data
    ? admin.from("crew_members").update(payload).eq("id", String((existing.data as { id?: string }).id ?? ""))
    : admin.from("crew_members").insert({ production_id: input.productionId, ...payload })

  const { data, error } = await query.select(CREW_KEYS).single()
  if (error) {
    console.warn(`[productions] invite failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true, data: rowToCrew(data as Record<string, unknown>) }
}

/** يلغي دعوة معلّقة (المالك فقط). */
export async function cancelCrewInviteAction(input: {
  productionId: string
  memberId: string
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }
  if (!(await ownsProduction(admin, input.productionId, user.id))) {
    return { ok: false, error: "لا تملك صلاحية تعديل طاقم هذا العمل." }
  }

  const { error } = await admin.from("crew_members").delete().eq("id", input.memberId)
  if (error) {
    console.warn(`[productions] cancel invite failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true }
}

/** يغيّر حالة عضو الطاقم (استبعاد/مغادرة) — المالك فقط. */
export async function setCrewStatusAction(input: {
  productionId: string
  memberId: string
  status: "invited" | "accepted" | "declined" | "left" | "removed"
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }
  if (!(await ownsProduction(admin, input.productionId, user.id))) {
    return { ok: false, error: "لا تملك صلاحية تعديل طاقم هذا العمل." }
  }

  const { error } = await admin
    .from("crew_members")
    .update({ status: input.status, responded_at: new Date().toISOString() })
    .eq("id", input.memberId)

  if (error) {
    console.warn(`[productions] crew status failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true }
}

/** يقبل/يعتذر الفنان عن دعوة وصلته (بريده من الجلسة نفسها). */
export async function respondToInviteAction(input: {
  memberId: string
  decision: "accepted" | "declined"
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  const email = (user?.email ?? "").trim().toLowerCase()
  if (!user || !email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const { data, error } = await admin.from("crew_members").select("email").eq("id", input.memberId).maybeSingle()
  if (error || !data) return { ok: false, error: "الدعوة غير موجودة." }
  if (String((data as { email?: string }).email ?? "").trim().toLowerCase() !== email) {
    return { ok: false, error: "هذه الدعوة ليست لحسابك." }
  }

  const { error: updateError } = await admin
    .from("crew_members")
    .update({ status: input.decision, responded_at: new Date().toISOString() })
    .eq("id", input.memberId)

  if (updateError) {
    console.warn(`[productions] respond invite failed: ${updateError.message}`)
    return { ok: false, error: isTableMissing(updateError.message) ? TABLE_MISSING_MESSAGE : updateError.message }
  }
  return { ok: true }
}

/* ---------- الأودشنات ---------- */

/** ينشر أودشنًا جديدًا (يظهر فورًا لكل الفنانين). */
export async function createAuditionAction(input: {
  productionId?: string | null
  title: string
  role: string
  requirements: string
  pay: string
  venue: string
  date: string
}): Promise<MutationResult<Audition>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const title = text(input.title, 200)
  if (title.length < 2) return { ok: false, error: "عنوان الأودشن مطلوب." }

  const { data, error } = await admin
    .from("auditions")
    .insert({
      owner_id: user.id,
      owner_email: user.email.trim().toLowerCase(),
      production_id: input.productionId ? text(input.productionId, 60) : null,
      title,
      role: text(input.role, 120),
      requirements: text(input.requirements, 2000),
      pay: text(input.pay, 120),
      venue: text(input.venue, 200),
      date_text: text(input.date, 120),
      status: "open",
    })
    .select(AUDITION_KEYS)
    .single()

  if (error) {
    console.warn(`[productions] create audition failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true, data: rowToAudition(data as Record<string, unknown>) }
}

/** يغلق الأودشن أو يعيد فتحه — التغيير يظهر لكل الفنانين فورًا. */
export async function setAuditionStatusAction(input: {
  id: string
  status: "open" | "closed"
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const { data, error } = await admin.from("auditions").select("owner_id").eq("id", input.id).maybeSingle()
  if (error || !data) return { ok: false, error: "الأودشن غير موجود." }
  if (String((data as { owner_id?: string }).owner_id ?? "") !== user.id) {
    return { ok: false, error: "لا تملك صلاحية تعديل هذا الأودشن." }
  }

  const { error: updateError } = await admin.from("auditions").update({ status: input.status }).eq("id", input.id)
  if (updateError) {
    console.warn(`[productions] audition status failed: ${updateError.message}`)
    return { ok: false, error: isTableMissing(updateError.message) ? TABLE_MISSING_MESSAGE : updateError.message }
  }
  return { ok: true }
}

/** يقدّم الفنان على أودشن مفتوح (طلب واحد لكل أودشن). */
export async function applyToAuditionAction(input: {
  auditionId: string
  profileUrl: string
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  const email = (user?.email ?? "").trim().toLowerCase()
  if (!user || !email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const audition = await admin.from("auditions").select("status").eq("id", input.auditionId).maybeSingle()
  if (audition.error || !audition.data) return { ok: false, error: "الأودشن غير موجود." }
  if (String((audition.data as { status?: string }).status ?? "") !== "open") {
    return { ok: false, error: "هذا الأودشن مغلق حاليًا." }
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const actorName =
    ([metadata.full_name, metadata.name].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ?? email.split("@")[0]) || email

  const existing = await admin
    .from("audition_applications")
    .select("id")
    .eq("audition_id", input.auditionId)
    .ilike("actor_email", email)
    .maybeSingle()
  if (existing.error) {
    return { ok: false, error: isTableMissing(existing.error.message) ? TABLE_MISSING_MESSAGE : existing.error.message }
  }
  if (existing.data) return { ok: true } // تقدّم بالفعل — لا نُكرّر الطلب.

  const { error } = await admin.from("audition_applications").insert({
    audition_id: input.auditionId,
    actor_email: email,
    actor_name: actorName,
    profile_url: text(input.profileUrl, 2000),
    status: "pending",
  })

  if (error) {
    console.warn(`[productions] apply audition failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true }
}

/** يحدّد قرار الفرقة في طلب أودشن (مرحلة ثانية/قائمة قصيرة/استبعاد). */
export async function setApplicationStatusAction(input: {
  applicationId: string
  status: "pending" | "second_round" | "shortlist" | "rejected"
}): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  if (!user?.email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const application = await admin
    .from("audition_applications")
    .select("audition_id")
    .eq("id", input.applicationId)
    .maybeSingle()
  if (application.error || !application.data) return { ok: false, error: "الطلب غير موجود." }

  const auditionId = String((application.data as { audition_id?: string }).audition_id ?? "")
  const audition = await admin.from("auditions").select("owner_id").eq("id", auditionId).maybeSingle()
  if (audition.error || !audition.data) return { ok: false, error: "الأودشن غير موجود." }
  if (String((audition.data as { owner_id?: string }).owner_id ?? "") !== user.id) {
    return { ok: false, error: "لا تملك صلاحية مراجعة طلبات هذا الأودشن." }
  }

  const { error } = await admin
    .from("audition_applications")
    .update({ status: input.status })
    .eq("id", input.applicationId)
  if (error) {
    console.warn(`[productions] application status failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true }
}

/* ---------- إنجازات الفنان ---------- */

export async function addAchievementAction(input: {
  kind: "course" | "workshop" | "external"
  title: string
  organizer: string
  year: string
  link: string
}): Promise<MutationResult<Achievement>> {
  const user = await getSupabaseUser()
  const email = (user?.email ?? "").trim().toLowerCase()
  if (!user || !email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const title = text(input.title, 200)
  if (title.length < 2) return { ok: false, error: "عنوان الإنجاز مطلوب." }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const actorName =
    ([metadata.full_name, metadata.name].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ?? email.split("@")[0]) || email

  const { data, error } = await admin
    .from("achievements")
    .insert({
      actor_email: email,
      actor_name: actorName,
      kind: input.kind,
      title,
      organizer: text(input.organizer, 160),
      year: text(input.year, 20),
      link: text(input.link, 500),
    })
    .select("id, actor_email, actor_name, kind, title, organizer, year, link")
    .single()

  if (error) {
    console.warn(`[productions] add achievement failed: ${error.message}`)
    return { ok: false, error: isTableMissing(error.message) ? TABLE_MISSING_MESSAGE : error.message }
  }
  return { ok: true, data: rowToAchievement(data as Record<string, unknown>) }
}

/** يحذف إنجازًا للفنان الحالي فقط. */
export async function removeAchievementAction(input: { id: string }): Promise<MutationResult<null>> {
  const user = await getSupabaseUser()
  const email = (user?.email ?? "").trim().toLowerCase()
  if (!user || !email) return notSignedIn()

  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: "Supabase غير مهيأ على السيرفر." }

  const { data, error } = await admin.from("achievements").select("actor_email").eq("id", input.id).maybeSingle()
  if (error || !data) return { ok: false, error: "الإنجاز غير موجود." }
  if (String((data as { actor_email?: string }).actor_email ?? "").trim().toLowerCase() !== email) {
    return { ok: false, error: "هذا الإنجاز ليس لحسابك." }
  }

  const { error: deleteError } = await admin.from("achievements").delete().eq("id", input.id)
  if (deleteError) {
    console.warn(`[productions] remove achievement failed: ${deleteError.message}`)
    return { ok: false, error: isTableMissing(deleteError.message) ? TABLE_MISSING_MESSAGE : deleteError.message }
  }
  return { ok: true }
}
