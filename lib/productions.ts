"use client"

import { useSyncExternalStore } from "react"

/**
 * مساحة عمل الإنتاج: العروض وطاقمها ودعواته، الأودشنات ومتقدميها، والإنجازات.
 *
 * لا يوجد جدول إنتاج في قاعدة البيانات بعد (نفس أسلوب باقي اللوحات: محاكاة ثم
 * ربط حقيقي)، لذا تُخزَّن الحالة في `localStorage` ويقرأها الـ Layout عبر
 * `useWorkspace()`، فتظهر دعوة الفرقة فورًا في لوحة الممثل والعكس.
 */

export type ShowStatus = "coming_soon" | "on_sale" | "archived"
export type SeatingMode = "numbered" | "general_admission"
export type CrewStatus = "invited" | "accepted" | "declined" | "left" | "removed"
export type AuditionStatus = "open" | "closed"
export type ApplicationStatus = "pending" | "second_round" | "shortlist" | "rejected"
export type AchievementKind = "course" | "workshop" | "external"

export type TicketTier = {
  id: string
  name: string
  priceEgp: number
  capacity: number
  /** لون الفئة (hex) — يظهر في دليل الفئات وخريطة المقاعد. */
  color: string
  /** نطاق الصفوف (فهارس صفرية) التي تنتمي لهذه الفئة. */
  rows: number[]
}

export type CrewMember = {
  id: string
  name: string
  email: string
  part: string
  status: CrewStatus
  invitedAt: string
  respondedAt?: string
}

export type Production = {
  id: string
  title: string
  posterUrl: string
  status: ShowStatus
  createdAt: string
  /** `null` = «يحدد لاحقاً». */
  venue: string | null
  tiers: TicketTier[]
  seatingMode: SeatingMode
  rows: number
  seatsPerRow: number
  /** مقاعد معطّلة لا تُطرح للبيع (مثل "A3"). */
  blockedSeats: string[]
  /** للفئات المفتوحة: سعة القاعة والإجمالي المُباع لحساب المتبقي. */
  capacity: number
  sold: number
  gallery: string[]
  crew: CrewMember[]
  archivedAt?: string
}

export type Audition = {
  id: string
  productionId: string | null
  title: string
  role: string
  requirements: string
  pay: string
  venue: string
  date: string
  status: AuditionStatus
  createdAt: string
}

export type AuditionApplication = {
  id: string
  auditionId: string
  actorName: string
  actorEmail: string
  /** رابط بروفايل الممثل الذي يُرفق مع التقديم. */
  profileUrl: string
  status: ApplicationStatus
  appliedAt: string
}

export type Achievement = {
  id: string
  actorName: string
  actorEmail: string
  kind: AchievementKind
  title: string
  organizer: string
  year: string
  link: string
}

export type Workspace = {
  productions: Production[]
  auditions: Audition[]
  applications: AuditionApplication[]
  achievements: Achievement[]
}

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  coming_soon: "قريبًا / Coming Soon",
  on_sale: "معروض للبيع",
  archived: "مؤرشف",
}

export const SEATING_MODE_LABELS: Record<SeatingMode, string> = {
  numbered: "كراسي محددة بأرقام",
  general_admission: "فئات مفتوحة (بلا أرقام)",
}

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  invited: "دعوة معلقة",
  accepted: "في الطاقم",
  declined: "اعتذر",
  left: "غادر الفرقة",
  removed: "استُبعد",
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "قيد المراجعة",
  second_round: "مقبول للمرحلة الثانية",
  shortlist: "القائمة القصيرة",
  rejected: "مستبعد",
}

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, "green" | "amber" | "red" | "gray"> = {
  pending: "gray",
  second_round: "green",
  shortlist: "amber",
  rejected: "red",
}

export const ACHIEVEMENT_KIND_LABELS: Record<AchievementKind, string> = {
  course: "كورس",
  workshop: "ورشة مسرحية",
  external: "عمل خارج المنصة",
}

/** تُخزَّن قيمة المسرح غير المحدد كـ `null` وهذا نصّها المعروض. */
export const LATER_VENUE_LABEL = "يحدد لاحقاً"

/** فئات التذاكر الافتراضية داخل الخطوة الثانية (VIP ذهبي / صالة بنفسجي / بلكون رمادي). */
export const DEFAULT_TIERS: TicketTier[] = [
  { id: "vip", name: "VIP", priceEgp: 350, capacity: 24, color: "#f5c451", rows: [0, 1] },
  { id: "hall", name: "صالة", priceEgp: 250, capacity: 60, color: "#7c5cff", rows: [2, 3, 4] },
  { id: "balcony", name: "بلكون", priceEgp: 150, capacity: 80, color: "#9aa4b2", rows: [5, 6, 7, 8, 9] },
]

/** ألوان جاهزة لاختيار لون الفئة في نموذج إنشاء العرض. */
export const TIER_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: "ذهبي VIP", color: "#f5c451" },
  { label: "بنفسجي الصالة", color: "#7c5cff" },
  { label: "أزرق", color: "#3b82f6" },
  { label: "تركواز", color: "#22d3ee" },
  { label: "وردي", color: "#ff4d94" },
  { label: "أخضر", color: "#34d399" },
  { label: "رمادي البلكون", color: "#9aa4b2" },
  { label: "أبيض", color: "#f8fafc" },
]

/** فئة أسعار بصيغة محرك الحجز/خريطة المقاعد (السعر بالقروش + اللون + الصفوف). */
export type SeatPriceTier = { id: string; name: string; priceCents: number; color: string; rows: number[] }

/**
 * يحوّل فئات العرض المخصصة (المحفوظة في مساحة عمل الفرقة) إلى صيغة فئات الأسعار
 * التي يقرأها محرك الحجز وخريطة المقاعد — لكل عرض بشكل مستقل.
 */
export function productionSeatTiers(tiers: TicketTier[]): SeatPriceTier[] {
  return tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    priceCents: Math.round(tier.priceEgp * 100),
    color: tier.color,
    rows: [...tier.rows].sort((a, b) => a - b),
  }))
}

/** يطابق عرضًا محفوظًا في مساحة العمل مع عرض قاعدة البيانات بالعنوان. */
export function findProductionByTitle(productions: Production[], title: string): Production | null {
  const target = title.trim().toLowerCase()
  if (target.length === 0) return null
  return productions.find((production) => production.title.trim().toLowerCase() === target) ?? null
}

/** دليل الممثلين والمساعدين لإرسال دعوات الانضمام من لوحة الفرقة. */
export const INVITE_DIRECTORY: { name: string; email: string; specialty: string }[] = [
  { name: "كريم عادل", email: "karim@kawalees.test", specialty: "ممثل — كوميديا ومونودراما" },
  { name: "منى فاروق", email: "mona@kawalees.test", specialty: "ممثلة — دراما" },
  { name: "سامح رضوان", email: "sameh@kawalees.test", specialty: "حكواتي وصوت" },
  { name: "هدى الشريف", email: "hoda@kawalees.test", specialty: "مساعد مخرج" },
  { name: "طارق مبروك", email: "tarek@kawalees.test", specialty: "إضاءة ومسرح تقني" },
]

export const CREW_PARTS = ["ممثل", "ممثلة", "مساعد مخرج", "إضاءة", "ديكور", "موسيقى"] as const

/* ---------- بيانات تجريبية أولية ---------- */

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

function seatLabel(row: number, seat: number): string {
  return `${String.fromCharCode(65 + row)}${seat}`
}

/**
 * مساحة العمل تبدأ ببيانات معقولة (عرض معروض للبيع + عرض «قريبًا»، أودشنات
 * ومتقدمون بحالات مختلفة، وإنجازات) لتظهر اللوحتان بمحتوى حقيقي من أول زيارة.
 */
function seedWorkspace(): Workspace {
  return {
    productions: [
      {
        id: "prod-qahwa",
        title: "ليلة في القهوة",
        posterUrl: "/placeholder.svg",
        status: "on_sale",
        createdAt: daysAgo(40),
        venue: "مسرح الهوسابير",
        tiers: DEFAULT_TIERS,
        seatingMode: "numbered",
        rows: 6,
        seatsPerRow: 10,
        blockedSeats: ["A1", "A2"],
        capacity: 96,
        sold: 78,
        gallery: [],
        crew: [
          {
            id: "crew-1",
            name: "كريم عادل",
            email: "karim@kawalees.test",
            part: "ممثل",
            status: "accepted",
            invitedAt: daysAgo(38),
            respondedAt: daysAgo(37),
          },
          {
            id: "crew-2",
            name: "منى فاروق",
            email: "mona@kawalees.test",
            part: "ممثلة",
            status: "invited",
            invitedAt: daysAgo(3),
          },
          {
            id: "crew-3",
            name: "سامح رضوان",
            email: "sameh@kawalees.test",
            part: "موسيقى",
            status: "removed",
            invitedAt: daysAgo(35),
            respondedAt: daysAgo(10),
          },
        ],
      },
      {
        id: "prod-ghorfa",
        title: "غرفة 204",
        posterUrl: "/placeholder.svg",
        status: "coming_soon",
        createdAt: daysAgo(2),
        venue: null,
        tiers: [],
        seatingMode: "general_admission",
        rows: 8,
        seatsPerRow: 12,
        blockedSeats: [],
        capacity: 0,
        sold: 0,
        gallery: [],
        crew: [
          {
            id: "crew-4",
            name: "سامح رضوان",
            email: "sameh@kawalees.test",
            part: "ممثل",
            status: "invited",
            invitedAt: daysAgo(1),
          },
        ],
      },
    ],
    auditions: [
      {
        id: "aud-nadil",
        productionId: "prod-qahwa",
        title: "أودشن «ليلة في القهوة»",
        role: "النادل",
        requirements: "خبرة مسرحية سنتان، إجادة الارتجال، والتواجد في القاهرة للبروفات.",
        pay: "3000 ج.م للعرض",
        venue: "مسرح الهوسابير",
        date: "السبت 4 أكتوبر — 6 مساءً",
        status: "open",
        createdAt: daysAgo(12),
      },
      {
        id: "aud-hakawati",
        productionId: null,
        title: "أودشن «حكاية الظل»",
        role: "الحكواتي",
        requirements: "صوت قوي وإلقاء شعري، ويُفضّل خبرة حكواتي مسرح الساقية.",
        pay: "2500 ج.م للعرض",
        venue: "ساقية الصاوي",
        date: "الأحد 12 أكتوبر — 5 مساءً",
        status: "open",
        createdAt: daysAgo(8),
      },
    ],
    applications: [
      {
        id: "app-1",
        auditionId: "aud-nadil",
        actorName: "كريم عادل",
        actorEmail: "karim@kawalees.test",
        profileUrl: "https://kawalees.test/actors/karim",
        status: "second_round",
        appliedAt: daysAgo(10),
      },
      {
        id: "app-2",
        auditionId: "aud-nadil",
        actorName: "منى فاروق",
        actorEmail: "mona@kawalees.test",
        profileUrl: "https://kawalees.test/actors/mona",
        status: "shortlist",
        appliedAt: daysAgo(9),
      },
      {
        id: "app-3",
        auditionId: "aud-nadil",
        actorName: "سامح رضوان",
        actorEmail: "sameh@kawalees.test",
        profileUrl: "https://kawalees.test/actors/sameh",
        status: "pending",
        appliedAt: daysAgo(4),
      },
      {
        id: "app-4",
        auditionId: "aud-hakawati",
        actorName: "سامح رضوان",
        actorEmail: "sameh@kawalees.test",
        profileUrl: "https://kawalees.test/actors/sameh",
        status: "rejected",
        appliedAt: daysAgo(3),
      },
    ],
    achievements: [
      {
        id: "ach-1",
        actorName: "كريم عادل",
        actorEmail: "karim@kawalees.test",
        kind: "workshop",
        title: "ورشة ارتجال متقدم",
        organizer: "ساقية الصاوي",
        year: "2025",
        link: "",
      },
      {
        id: "ach-2",
        actorName: "كريم عادل",
        actorEmail: "karim@kawalees.test",
        kind: "external",
        title: "مونودراما «القهوة» — مهرجان الطليعة",
        organizer: "مهرجان الطليعة المستقل",
        year: "2024",
        link: "",
      },
    ],
  }
}

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

export const WORKSPACE_STORAGE_KEY = "kawalees:productions"
export const WORKSPACE_CHANGE_EVENT = "kawalees:productions-change"

/** لقطة السيرفر الثابتة: البيانات التجريبية حتى تُقرأ الحالة الحقيقية من المتصفح. */
const SERVER_SNAPSHOT = seedWorkspace()

function parseWorkspace(raw: string | null): Workspace {
  if (!raw) return seedWorkspace()
  try {
    const parsed = JSON.parse(raw) as Partial<Workspace> | null
    if (!parsed || typeof parsed !== "object") return seedWorkspace()
    return {
      productions: Array.isArray(parsed.productions) ? parsed.productions : [],
      auditions: Array.isArray(parsed.auditions) ? parsed.auditions : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    }
  } catch {
    return seedWorkspace()
  }
}

let cachedRaw: string | null | undefined
let cachedWorkspace: Workspace = SERVER_SNAPSHOT

/** يقرأ الحالة من التخزين المحلي (وعلى السيرفر يُعيد اللقطة الثابتة). */
export function readWorkspace(): Workspace {
  if (typeof window === "undefined") return SERVER_SNAPSHOT
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedWorkspace = parseWorkspace(raw)
  }
  return cachedWorkspace
}

function persistWorkspace(workspace: Workspace): void {
  if (typeof window === "undefined") return
  cachedWorkspace = workspace
  const raw = JSON.stringify(workspace)
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, raw)
  } catch {
    // تخزين ممتلئ أو معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT))
}

/** يُمرّر الحالة عبر دالة نقية ثم يحفظها ويُبلغ كل اللوحات المفتوحة. */
function mutate(updater: (current: Workspace) => Workspace): void {
  persistWorkspace(updater(readWorkspace()))
}

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`
const nowIso = () => new Date().toISOString()

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(WORKSPACE_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(WORKSPACE_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = () => SERVER_SNAPSHOT

/** حالة الإنتاج كاملة — تبقى متزامنة بين لوحة الفرقة ولوحة الممثل. */
export function useWorkspace(): Workspace {
  return useSyncExternalStore(subscribe, readWorkspace, getServerSnapshot)
}

/* ---------- الكتابة ---------- */

/**
 * الخطوة الأولى من نموذج إضافة عمل مسرحي: الاسم والبوستر فقط، ويُنشر العرض
 * فورًا بحالة «قريبًا / Coming Soon» بلا انتظار بقية البيانات.
 */
export function createProduction(input: { title: string; posterUrl: string }): Production {
  const production: Production = {
    id: createId("prod"),
    title: input.title.trim(),
    posterUrl: input.posterUrl.trim(),
    status: "coming_soon",
    createdAt: nowIso(),
    venue: null,
    tiers: [],
    seatingMode: "numbered",
    rows: 6,
    seatsPerRow: 10,
    blockedSeats: [],
    capacity: 0,
    sold: 0,
    gallery: [],
    crew: [],
  }
  mutate((current) => ({ ...current, productions: [production, ...current.productions] }))
  return production
}

export function updateProduction(id: string, patch: Partial<Production>): void {
  mutate((current) => ({
    ...current,
    productions: current.productions.map((production) =>
      production.id === id ? { ...production, ...patch } : production,
    ),
  }))
}

export function inviteCrewMember(
  productionId: string,
  input: { name: string; email: string; part: string },
): void {
  const member: CrewMember = {
    id: createId("crew"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    part: input.part,
    status: "invited",
    invitedAt: nowIso(),
  }
  mutate((current) => ({
    ...current,
    productions: current.productions.map((production) =>
      production.id === productionId ? { ...production, crew: [...production.crew, member] } : production,
    ),
  }))
}

/** إلغاء دعوة معلقة (تُحذف لأنها لم تُقبل بعد، بخلاف الاستبعاد الذي يبقى سجلًا). */
export function cancelCrewInvite(productionId: string, memberId: string): void {
  mutate((current) => ({
    ...current,
    productions: current.productions.map((production) =>
      production.id === productionId
        ? { ...production, crew: production.crew.filter((member) => member.id !== memberId) }
        : production,
    ),
  }))
}

/**
 * تغيير حالة عضو الطاقم: قبول/اعتذار (من الممثل) أو استبعاد (من الفرقة) أو
 * مغادرة (من الممثل) — والاستبعاد والمغادرة يُبقيان الاسم في سجل الطاقم كسابقة أعمال.
 */
export function setCrewStatus(productionId: string, memberId: string, status: CrewStatus): void {
  mutate((current) => ({
    ...current,
    productions: current.productions.map((production) =>
      production.id === productionId
        ? {
            ...production,
            crew: production.crew.map((member) =>
              member.id === memberId ? { ...member, status, respondedAt: nowIso() } : member,
            ),
          }
        : production,
    ),
  }))
}

export function createAudition(input: {
  productionId: string | null
  title: string
  role: string
  requirements: string
  pay: string
  venue: string
  date: string
}): void {
  const audition: Audition = { id: createId("aud"), status: "open", createdAt: nowIso(), ...input }
  mutate((current) => ({ ...current, auditions: [audition, ...current.auditions] }))
}

export function setAuditionStatus(id: string, status: AuditionStatus): void {
  mutate((current) => ({
    ...current,
    auditions: current.auditions.map((audition) => (audition.id === id ? { ...audition, status } : audition)),
  }))
}

/** تقديم الممثل بضغطة واحدة مع رابط بروفايله (بلا تكرار لنفس البريد على نفس الأودشن). */
export function applyToAudition(input: {
  auditionId: string
  actorName: string
  actorEmail: string
  profileUrl: string
}): void {
  const application: AuditionApplication = { id: createId("app"), status: "pending", appliedAt: nowIso(), ...input }
  mutate((current) => {
    const email = input.actorEmail.trim().toLowerCase()
    const duplicate = current.applications.some(
      (item) => item.auditionId === input.auditionId && item.actorEmail.trim().toLowerCase() === email,
    )
    return duplicate ? current : { ...current, applications: [application, ...current.applications] }
  })
}

export function setApplicationStatus(applicationId: string, status: ApplicationStatus): void {
  mutate((current) => ({
    ...current,
    applications: current.applications.map((item) => (item.id === applicationId ? { ...item, status } : item)),
  }))
}

export function addAchievement(input: Omit<Achievement, "id">): void {
  const achievement: Achievement = { id: createId("ach"), ...input }
  mutate((current) => ({ ...current, achievements: [achievement, ...current.achievements] }))
}

export function removeAchievement(id: string): void {
  mutate((current) => ({ ...current, achievements: current.achievements.filter((item) => item.id !== id) }))
}

/* ---------- قراءات مشتركة بين لوحة الفرقة ولوحة الممثل ---------- */

export type ViewerIdentity = { name: string; email: string }
export type ActorWork = { production: Production; member: CrewMember }

/** مطابقة عضو الطاقم بالمستخدم الحالي: بالبريد أولًا ثم بالاسم (للتجربة بلا حسابات حقيقية). */
export function crewMatchesViewer(member: CrewMember, viewer: ViewerIdentity): boolean {
  const email = viewer.email.trim().toLowerCase()
  if (email.length > 0 && member.email.trim().toLowerCase() === email) return true
  const name = viewer.name.trim().toLowerCase()
  return name.length > 0 && member.name.trim().toLowerCase() === name
}

/** الدعوات المعلقة التي وصلت للممثل الحالي من الفرق. */
export function pendingInvitesForActor(productions: Production[], viewer: ViewerIdentity): ActorWork[] {
  return productions.flatMap((production) =>
    production.crew
      .filter((member) => member.status === "invited" && crewMatchesViewer(member, viewer))
      .map((member) => ({ production, member })),
  )
}

/** أعمال الممثل الجارية: هو عضو مقبول في طاقمها. */
export function activeWorksForActor(productions: Production[], viewer: ViewerIdentity): ActorWork[] {
  return productions.flatMap((production) =>
    production.crew
      .filter((member) => member.status === "accepted" && crewMatchesViewer(member, viewer))
      .map((member) => ({ production, member })),
  )
}

/** أرشيف سابقة الأعمال: مغادرة أو استبعاد — والاسم يبقى محفوظًا في سجل الطاقم. */
export function archivedWorksForActor(productions: Production[], viewer: ViewerIdentity): ActorWork[] {
  return productions.flatMap((production) =>
    production.crew
      .filter(
        (member) => (member.status === "left" || member.status === "removed") && crewMatchesViewer(member, viewer),
      )
      .map((member) => ({ production, member })),
  )
}

export function crewByStatus(production: Production, status: CrewStatus): CrewMember[] {
  return production.crew.filter((member) => member.status === status)
}

/** العدد المتبقي من التذاكر — يُعرض بدل أرقام الكراسي في الفئات المفتوحة. */
export function remainingTickets(production: Production): number {
  return Math.max(production.capacity - production.sold, 0)
}

/** كل تسميات المقاعد الرقمية للعرض (A1، A2، …) لمعاينة الصفوف والكراسي. */
export function seatLabels(production: Pick<Production, "rows" | "seatsPerRow">): string[] {
  const labels: string[] = []
  for (let row = 0; row < production.rows; row += 1) {
    for (let seat = 1; seat <= production.seatsPerRow; seat += 1) labels.push(seatLabel(row, seat))
  }
  return labels
}

/** قائمة تحقق الخطوة الثانية (اختيارية) لكل عرض. */
export function stepTwoChecklist(production: Production): { label: string; done: boolean }[] {
  return [
    { label: "مكان العرض", done: production.venue !== null },
    { label: "فئات وأسعار التذاكر", done: production.tiers.length > 0 },
    {
      label: "طريقة الحجز",
      done:
        production.seatingMode === "numbered"
          ? production.rows > 0 && production.seatsPerRow > 0
          : production.capacity > 0,
    },
    { label: "معرض الصور الدعائية", done: production.gallery.length > 0 },
    { label: "طاقم العمل", done: production.crew.some((member) => member.status === "accepted") },
  ]
}

