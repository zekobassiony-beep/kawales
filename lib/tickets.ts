"use client"

import { useSyncExternalStore } from "react"
import { sendTelegramNotification } from "@/lib/telegram"
import type { ServiceFeeMode } from "@/lib/coupon-pricing"
import {
  isTicketPending,
  normalizeTicketStatus,
  type TicketStatus,
} from "@/lib/ticket-status"

/**
 * منظومة التذاكر والمدفوعات المباشرة (Checkout & Direct Payment Gateway).
 *
 * لا يوجد جدول تذاكر في قاعدة البيانات بعد (نفس أسلوب باقي اللوحات:
 * محاكاة ثم ربط حقيقي)، لذا تُخزَّن التذاكر في `localStorage` ويقرأها
 * كل من صفحة الحجز ولوحة العميل عبر `useTickets()` أو القراءات المباشرة.
 */

/** يُعاد تصدير أدوات الحالة الموحّدة ليستوردها كل من الواجهة والسيرفر من مكان واحد. */
export {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  isTicketAccepted,
  isTicketPending,
  isTicketRejected,
  normalizeTicketStatus,
  ticketStatusLabel,
  ticketStatusTone,
} from "@/lib/ticket-status"
export type { TicketStatus } from "@/lib/ticket-status"

/** معرّف وسيلة الدفع — نص حر لأن الوسائل تُدار ديناميكيًا من لوحة العمليات. */
export type PaymentMethod = string
/** معرّفات وسائل الدفع الافتراضية. */
export const DEFAULT_PAYMENT_METHOD_ID = "vodafone_cash"
/** معرّف وسيلة الدفع للتذكرة المجانية الناتجة عن كوبون 100% (بلا تحويل). */
export const FREE_COUPON_PAYMENT_METHOD_ID = "coupon_free"
/** مصدر اعتماد التحويل: أوتوميشن بوت التليجرام، أو رسالة SMS، أو بوابة دفع. */
export type VerificationChannel = "telegram" | "sms" | "gateway"

/**
 * لقطة كوبون الخصم وقت الحجز — تُخزَّن مع التذكرة حتى يظل «شكل الخصم»
 * (السعر الأصلي المشطوب + رسوم الخدمة المجانية) صحيحًا بعد انتهاء الحملة.
 */
export type TicketCoupon = {
  code: string
  label?: string
  discountPct: number
  serviceFeeMode: ServiceFeeMode
  /** الإجمالي لولا الكوبون (بالقروش). */
  originalTotalCents: number
  discountCents: number
  serviceFeeSavingCents: number
}

export type Ticket = {
  /** مرجع التذكرة بصيغة KW-XXXXXX. */
  id: string
  showId: string
  showTitle: string
  /** بوستر العرض — يُستعمل في كارت السوشيال ميديا. */
  posterUrl?: string
  venue: string
  startsAt: string
  /** معرف العميل (البريد الإلكتروني). */
  customerId: string
  customerName: string
  /** مقاعد محددة (A3…) أو وصف فئات مفتوحة مثل «2 × VIP». */
  seats: string[]
  tierName: string
  /** موعد العرض بتوقيت ISO (يُستعمل لزر تقويم جوجل) — اختياري. */
  startsAtIso?: string
  /** الإجمالي بالقروش (piastres) ليطابق `formatPrice`. */
  totalCents: number
  /** لقطة كوبون الخصم (إن وُجد) — لعرض «شكل الخصم» على التذكرة. */
  coupon?: TicketCoupon
  paymentMethod: PaymentMethod
  paymentRef: string
  status: TicketStatus
  /** رابط/Base64 لصورة إيصال التحويل المرفقة. */
  receiptImage?: string
  /** رقم الموبايل الذي تم التحويل منه. */
  senderPhone?: string
  /** معرّف محادثة تليجرام للعميل (يُربط عبر `/start` في البوت) لإرسال التذكرة له. */
  telegramChatId?: string
  /**
   * رابط صورة التذكرة/QR التي يولّدها بوت تليجرام ويخزّنها في Supabase Storage.
   * الموقع يعرض هذه الصورة فقط (Viewer) — وتكون متاحة بعد اعتماد الإدارة.
   */
  ticketImageUrl?: string
  /** حمولة رمز QR (مرجع التذكرة + العرض). */
  qrCode: string
  /** وقت اعتماد الأوتوميشن (تليجرام/SMS) — لا يوجد قبل التحقق. */
  verifiedAt?: string
  /** القناة التي اعتمدت التحويل آليًا. */
  verifiedVia?: VerificationChannel
  /** وقت تسجيل الحضور عند بوابة المسرح (Gate Check-in). */
  checkedInAt?: string
  createdAt: string
}

export const TICKETS_STORAGE_KEY = "kawalees:tickets"
export const TICKETS_CHANGE_EVENT = "kawalees:tickets-change"

/** بيانات الدفع المباشر للمنصة (محاكاة إلى حين ربط بوابة حقيقية). */
export const VODAFONE_WALLET_NUMBER = "01000000000"
export const INSTAPAY_HANDLE = "kawalees@instapay"
export const INSTAPAY_APP_URL = "https://installments.insta-pay.app/"
export const TELEGRAM_TICKET_BOT = "Kawalees_tix_bot"

/** تسميات وسائل الدفع المعروفة (تُدار تفاصيلها ديناميكيًا من `lib/payment-methods`). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  instapay: "انستا باي (InstaPay)",
  [FREE_COUPON_PAYMENT_METHOD_ID]: "تذكرة مجانية (كوبون)",
}

/** اسم وسيلة الدفع المعروض للجمهور — يرجع للمعرّف إن كانت وسيلة مضافة حديثًا. */
export function paymentMethodLabel(id: string): string {
  return PAYMENT_METHOD_LABELS[id] ?? id
}

/* ---------- أوتوميشن التليجرام و SMS ---------- */

/** رابط بوت كواليس المباشر (deep link) مع إرفاق كود التذكرة. */
export function telegramTicketLink(ticketId: string): string {
  return `https://t.me/${TELEGRAM_TICKET_BOT}?start=${encodeURIComponent(ticketId)}`
}

/** نص رسالة الإثبات التي يرسلها العميل للبوت تلقائيًا عند فتح الرابط. */
export function telegramTicketMessage(ticket: Ticket): string {
  return [
    `كود التذكرة: ${ticket.id}`,
    `العرض: ${ticket.showTitle}`,
    `المقاعد: ${ticket.seats.join("، ")}`,
    `الإجمالي: ${formatPiastres(ticket.totalCents)}`,
    `طريقة الدفع: ${paymentMethodLabel(ticket.paymentMethod)}`,
    `رقم المحوّل: ${ticket.senderPhone ?? ticket.paymentRef}`,
  ].join("\n")
}

/** نص رسالة SMS التأكيد التي تُرسل آليًا بعد اعتماد التحويل. */
export function smsConfirmationText(ticket: Ticket): string {
  return `كواليس: تم اعتماد تذكريتك ${ticket.id} لعرض ${ticket.showTitle}. اعرض رمز QR من حسابك عند البوابة.`
}

/** تنسيق بسيط للسعر بالقروش (مستقل عن طبقة العرض). */
function formatPiastres(piastres: number): string {
  return `${(Math.round(piastres) / 100).toLocaleString("ar-EG")} ج.م`
}

/* ---------- توليد رمز QR (مُولّد حقيقي في `lib/qr`) ---------- */

/** يُعاد تصدير مُولّد رمز QR الحقيقي (Byte Mode · مستوى M · منطقة هدوء). */
export { qrMatrix, withQuietZone, QR_QUIET_ZONE } from "@/lib/qr"

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parseTickets(raw: string | null): Ticket[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // ترحيل الحالات القديمة إلى نموذج المراجعة اليدوية للإيصال.
    return (parsed as Ticket[]).map((ticket) => {
      const old = ticket.status as string
      const status: TicketStatus =
        old === "checked_in"
          ? "checked_in"
          : old === "verified"
            ? "approved"
            : old === "rejected"
              ? "rejected"
              : "pending"
      return { ...ticket, status }
    })
  } catch {
    return []
  }
}

let cachedRaw: string | null | undefined
let cachedTickets: Ticket[] = []

/** يقرأ التذاكر من التخزين المحلي (وعلى السيرفر يعيد قائمة فارغة). */
export function readTickets(): Ticket[] {
  if (typeof window === "undefined") return []
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(TICKETS_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedTickets = parseTickets(raw)
  }
  return cachedTickets
}

function persistTickets(tickets: Ticket[]): void {
  if (typeof window === "undefined") return
  cachedTickets = tickets
  const raw = JSON.stringify(tickets)
  try {
    window.localStorage.setItem(TICKETS_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(TICKETS_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(TICKETS_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(TICKETS_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): Ticket[] => []

/** قائمة التذاكر الحالية — متزامنة بين صفحة الحجز ولوحة العميل. */
export function useTickets(): Ticket[] {
  return useSyncExternalStore(subscribe, readTickets, getServerSnapshot)
}

const makeReference = () =>
  `KW-${Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ123456789"[Math.floor(Math.random() * 33)]).join("")}`

/* ---------- العمليات العامة ---------- */

export type CreateTicketInput = {
  showId: string
  showTitle: string
  posterUrl?: string
  venue: string
  startsAt: string
  customerId: string
  customerName: string
  seats: string[]
  tierName: string
  startsAtIso?: string
  totalCents: number
  paymentMethod: PaymentMethod
  paymentRef: string
  receiptImage?: string
  senderPhone?: string
  /** لقطة كوبون الخصم المطبَّق عند الحجز (اختياري). */
  coupon?: TicketCoupon
}

/**
 * ينشئ تذكرة بحالة `pending` (بانتظار مراجعة إيصال التحويل من الإدارة)
 * مع رمز QR — ويبقى الـ QR محجوبًا حتى قبول الإدارة.
 */
export function createTicket(input: CreateTicketInput): Ticket {
  const reference = makeReference()
  const ticket: Ticket = {
    id: reference,
    ...input,
    customerId: input.customerId.trim().toLowerCase() || "guest@kawalees.test",
    paymentRef: input.paymentRef.trim(),
    senderPhone: input.senderPhone?.trim() || undefined,
    receiptImage: input.receiptImage || undefined,
    status: "pending",
    qrCode: `kawalees:ticket:${reference}:${input.showId}`,
    createdAt: new Date().toISOString(),
  }
  mutateTickets((current) => [ticket, ...current])

  // إشعار تليجرام بسيط (بديل سريع) — الإيصال الكامل يُرسل عبر `sendReceiptToTelegram`.
  const couponLine = ticket.coupon
    ? `\n🎫 كوبون: ${ticket.coupon.code} (−${ticket.coupon.discountPct}%)${
        ticket.coupon.originalTotalCents > ticket.totalCents
          ? ` — كان ${formatPiastres(ticket.coupon.originalTotalCents)}`
          : ""
      }${ticket.coupon.serviceFeeSavingCents > 0 ? " · رسوم الخدمة مجانًا" : ""}`
    : ""
  sendTelegramNotification(
    `🎭 تذكرة جديدة — كواليس\n🎟️ ${ticket.id}\n📌 ${ticket.showTitle}\n👤 ${ticket.customerName}\n💺 ${ticket.seats.join("، ")}\n💳 ${paymentMethodLabel(ticket.paymentMethod)}\n💰 ${formatPiastres(ticket.totalCents)}${couponLine}`,
  )

  return ticket
}

/** تذاكر مستخدم واحد (بمعرفه/بريده) مرتبة من الأحدث. */
export function getTicketsForUser(customerId: string): Ticket[] {
  const email = customerId.trim().toLowerCase()
  return readTickets().filter((ticket) => ticket.customerId === email)
}

/** جلب تذكرة واحدة بالمرجع. */
export function getTicketById(reference: string): Ticket | null {
  return readTickets().find((ticket) => ticket.id === reference.toUpperCase()) ?? null
}

/** قبول التذكرة يدويًا/عند البوابة: pending → approved. */
export function verifyTicket(
  reference: string,
  via: VerificationChannel = "telegram",
): { ok: boolean; ticket: Ticket | null; message: string } {
  return applyAutomationUpdate({ reference, status: "approved", via })
}

/** تبديل حالة التحقق من داخل اللوحات (تستعمله لوحة العميل). */
export function setTicketStatus(reference: string, status: TicketStatus): void {
  mutateTickets((current) => current.map((item) => (item.id === reference ? { ...item, status } : item)))
}

/** مطابقة مرنة للمرجع (تجاهل المسافات وحالة الأحرف). */
function referencesMatch(expected: string, received: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase()
  return normalize(expected) === normalize(received)
}

/**
 * نقطة الدخول الموحّدة لتحديث حالة التذكرة (قبول/رفض من الإدارة عبر التليجرام):
 * تستقبل القرار وتُحدّث التذكرة — وعند القبول يُفعَّل الـ QR فورًا.
 */
export function applyAutomationUpdate(input: {
  reference: string
  status?: TicketStatus
  via?: VerificationChannel
  /** مرجع التحويل المعتمد كما وصل من البوت (اختياري كتحقق إضافي). */
  paymentRef?: string
}): { ok: boolean; ticket: Ticket | null; message: string } {
  const reference = input.reference.trim().toUpperCase()
  const ticket = getTicketById(reference)
  if (!ticket) return { ok: false, ticket: null, message: `لا توجد تذكرة بالكود ${reference}.` }

  if (input.paymentRef && ticket.paymentRef.length > 0 && !referencesMatch(ticket.paymentRef, input.paymentRef)) {
    return { ok: false, ticket, message: "مرجع التحويل لا يطابق التذكرة — تم تجاهل التحديث." }
  }

  const status: TicketStatus = input.status ?? "approved"
  const via: VerificationChannel = input.via ?? "telegram"
  const updated: Ticket =
    status === "approved"
      ? { ...ticket, status, verifiedAt: new Date().toISOString(), verifiedVia: via }
      : { ...ticket, status }

  mutateTickets((current) => current.map((item) => (item.id === reference ? updated : item)))
  return {
    ok: true,
    ticket: updated,
    message:
      status === "approved"
        ? `تم قبول الحجز ${reference} — الـ QR فعّال الآن.`
        : status === "rejected"
          ? `تم رفض الحجز ${reference}.`
          : `تم تحديث حالة التذكرة ${reference}.`,
  }
}

/* ---------- مزامنة الحالة من السيرفر (قرار الإدارة على تليجرام) ---------- */

/** تحديث حالة تذكرة كما تعيده `/api/tickets/statuses` (مصدر الحقيقة للوحات). */
export type ServerTicketStatusUpdate = {
  id: string
  status: TicketStatus
  /** رابط صورة التذكرة/QR التي يولّدها بوت تليجرام (يتوفر بعد الاعتماد). */
  ticketImageUrl?: string | null
  /** وقت الحضور عند البوابة (يأتي من السيرفر بعد المسح). */
  checkedInAt?: string | null
}

/**
 * يدمج تحديثًا قادمًا من السيرفر في تذكرة محلية (دالة نقية قابلة للاختبار).
 * يعيد `null` إن لم يكن هناك تغيير يستحق الحفظ (لتقليل إعادة الرسم وكتابة التخزين).
 */
export function mergeServerTicketUpdate(ticket: Ticket, update: ServerTicketStatusUpdate): Ticket | null {
  const reference = update.id.trim().toUpperCase()
  if (ticket.id !== reference) return null

  const imageUrl = update.ticketImageUrl?.trim() ? update.ticketImageUrl.trim() : undefined
  const checkedInAt = update.checkedInAt?.trim() ? update.checkedInAt.trim() : undefined
  const status = normalizeTicketStatus(update.status)
  const statusChanged = normalizeTicketStatus(ticket.status) !== status
  const imageChanged = Boolean(imageUrl) && ticket.ticketImageUrl !== imageUrl
  const checkInChanged = Boolean(checkedInAt) && ticket.checkedInAt !== checkedInAt
  if (!statusChanged && !imageChanged && !checkInChanged) return null

  const next: Ticket = { ...ticket, status }
  if (imageUrl) next.ticketImageUrl = imageUrl
  if (checkedInAt) next.checkedInAt = checkedInAt
  if (statusChanged && status === "approved") {
    next.verifiedAt = next.verifiedAt ?? new Date().toISOString()
    next.verifiedVia = next.verifiedVia ?? "telegram"
  }
  return next
}

/**
 * يطبّق تحديث السيرفر على التخزين المحلي (لا يُنشئ تذاكر غير موجودة محليًا).
 * يعيد `true` إن تغيّرت التذكرة فعلًا — وهو ما يجعل الواجهة تتحدث فور اعتماد الإدارة.
 */
export function applyServerTicketUpdate(update: ServerTicketStatusUpdate): boolean {
  if (typeof window === "undefined") return false
  const reference = update.id.trim().toUpperCase()
  const current = readTickets()
  const index = current.findIndex((ticket) => ticket.id === reference)
  if (index < 0) return false

  const merged = mergeServerTicketUpdate(current[index], { ...update, id: reference })
  if (!merged) return false

  mutateTickets((list) => list.map((item, position) => (position === index ? merged : item)))
  return true
}

/** هل ما زالت التذكرة تحتاج متابعة من السيرفر؟ (لا نطارد تذاكر محسومة أو مستخدمة). */
function needsServerSync(ticket: Ticket): boolean {
  return ticket.status === "pending" || ticket.status === "approved"
}

/**
 * يزامن حالات مجموعة تذاكر من السيرفر بنداء واحد مجمّع، ويعيد عدد التذاكر التي تغيّرت.
 * يُستدعى من الاستطلاع الحيّ في الواجهة (لوحة العميل + معرض QR).
 */
export async function syncTicketStatusesFromServer(ids?: string[]): Promise<number> {
  if (typeof window === "undefined") return 0
  const candidates = (ids ?? readTickets().filter(needsServerSync).map((ticket) => ticket.id))
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean)
  if (candidates.length === 0) return 0

  try {
    const response = await fetch(
      `/api/tickets/statuses?ids=${encodeURIComponent(candidates.join(","))}`,
      { cache: "no-store" },
    )
    if (!response.ok) return 0
    const payload = (await response.json()) as { tickets?: ServerTicketStatusUpdate[] }
    if (!Array.isArray(payload.tickets)) return 0

    let changed = 0
    for (const update of payload.tickets) {
      if (applyServerTicketUpdate(update)) changed += 1
    }
    return changed
  } catch {
    // فشل الشبكة لا يجب أن يُعطّل الواجهة — نُعيد المحاولة في النبضة التالية.
    return 0
  }
}

/* ---------- قراءة حيّة لتذكرة واحدة (تحديث تلقائي فور اعتماد البوت) ---------- */

const getNullSnapshot = () => null

/** يتابع تذكرة واحدة ويُعيد تحديث المكوّن لحظة اعتماد الأوتوميشن للتحويل. */
export function useTicket(reference: string): Ticket | null {
  return useSyncExternalStore(
    subscribe,
    () => getTicketById(reference),
    getNullSnapshot,
  )
}

/**
 * نبضة تحقق دورية للانتظار الأنيق: تزامن حالات التذاكر المعلّقة مع السيرفر
 * (قرار الإدارة على تليجرام: `approve_/reject_`) وتحدّث الواجهة لحظة الاعتماد،
 * مع إطلاق حدث محلي لالتقاط أي تحديث من تبويب آخر.
 *
 * تتوقف تلقائيًا بعد `maxDurationMs` أو عند بقاء التذاكر محسومة، فلا استهلاك دائم للشبكة.
 */
export function startTicketStatusPolling(intervalMs = 4000, maxDurationMs = 10 * 60 * 1000): () => void {
  if (typeof window === "undefined") return () => undefined

  const startedAt = Date.now()
  let stopped = false
  let inFlight = false

  function stop(): void {
    if (stopped) return
    stopped = true
    window.clearInterval(timer)
  }

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) return
    if (Date.now() - startedAt > maxDurationMs) {
      stop()
      return
    }
    window.dispatchEvent(new Event(TICKETS_CHANGE_EVENT))
    inFlight = true
    try {
      await syncTicketStatusesFromServer()
    } finally {
      inFlight = false
    }
  }

  const timer = window.setInterval(() => void tick(), intervalMs)
  void tick()

  return stop
}

/**
 * يستبدل صورة الإيصال المخزّنة محليًا (Base64 ثقيل) بالرابط العام بعد رفعها على
 * السيرفر — يمنع تضخّم `localStorage` وبطء القراءة/الكتابة.
 */
export function setTicketReceiptUrl(reference: string, receiptUrl: string): void {
  const id = reference.trim().toUpperCase()
  const url = receiptUrl.trim()
  if (!url) return
  const target = readTickets().find((ticket) => ticket.id === id)
  if (!target || target.receiptImage === url) return
  mutateTickets((list) => list.map((ticket) => (ticket.id === id ? { ...ticket, receiptImage: url } : ticket)))
}

/** عدد التذاكر المعلّقة على مراجعة الإيصال لمستخدم واحد. */
export function pendingReviewCount(customerId: string): number {
  return getTicketsForUser(customerId).filter((ticket) => isTicketPending(ticket.status)).length
}

/** نتيجة فحص التذكرة عند البوابة. */
export type CheckInOutcome = "accepted" | "already_used" | "not_verified" | "not_found"

export type CheckInResult = {
  outcome: CheckInOutcome
  ticket: Ticket | null
  message: string
  /** وقت الحضور المسجّل (للتذكرة المقبولة أو المستخدمة مسبقًا). */
  checkedInAt?: string
}

/**
 * تسجيل الحضور عند بوابة المسرح (Gate Check-in):
 * تتأكد من وجود التذكرة وأنها `verified`، ثم تُحوّلها إلى `checked_in`
 * وتُسجّل وقت الحضور. التذكرة المستخدمة مسبقًا تُرجع تنبيهًا بوقت استخدامها.
 */
export function checkInTicket(ticketId: string): CheckInResult {
  const reference = ticketId.trim().toUpperCase()
  const ticket = getTicketById(reference)

  if (!ticket) {
    return { outcome: "not_found", ticket: null, message: `لا توجد تذكرة بالكود ${reference} في المنصة.` }
  }

  const status = normalizeTicketStatus(ticket.status)

  if (status === "checked_in") {
    return {
      outcome: "already_used",
      ticket,
      checkedInAt: ticket.checkedInAt,
      message: `تنبيه: تم استخدام هذه التذكرة مسبقًا في تمام الساعة ${formatClock(ticket.checkedInAt)}.`,
    }
  }

  if (status !== "approved") {
    return {
      outcome: "not_verified",
      ticket,
      message: "تذكرة غير مقبولة بعد — انتظر موافقة الإدارة على إيصال التحويل.",
    }
  }

  const checkedInAt = new Date().toISOString()
  const updated: Ticket = { ...ticket, status: "checked_in", checkedInAt }
  mutateTickets((current) => current.map((item) => (item.id === reference ? updated : item)))

  return {
    outcome: "accepted",
    ticket: updated,
    checkedInAt,
    message: `تم تسجيل الدخول بنجاح — أهلًا بك في ${ticket.showTitle}.`,
  }
}

/** تذاكر حضرت فعلًا لعرض معيّن (تُستعمل في شارة «جمهور موثق»). */
export function checkedInTicketsForShow(showId: string): Ticket[] {
  return readTickets().filter(
    (ticket) => ticket.showId === String(showId) && normalizeTicketStatus(ticket.status) === "checked_in",
  )
}

/** ساعة الحضور بصيغة مختصرة (للعرض في الماسح). */
function formatClock(value?: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
}

/** يعيد ساعة الحضور بصيغة مهيّأة للعرض (مُصدَّرة للماسح ولوحة العميل). */
export function formatCheckInTime(value?: string): string {
  return formatClock(value)
}

/** تذاكر قابلة للمسح الآن (مقبولة من الإدارة ولم تُستخدم بعد). */
export function scannableTickets(): Ticket[] {
  return readTickets().filter((ticket) => normalizeTicketStatus(ticket.status) === "approved")
}

/**
 * تقسيم تذاكر المستخدم إلى قادمة (حسب موعد العرض) وسابقة.
 *
 * ⚠️ التذكرة بلا موعد صالح (مثل صف قادم من قاعدة البيانات التي لا تخزّن `starts_at`)
 * تُعتبر **قادمة** — الخطأ في العرض لا يجوز أن يُخفي تذكرة مقبولة عن صاحبها.
 */
export function splitTickets(tickets: Ticket[], now = Date.now()): { upcoming: Ticket[]; past: Ticket[] } {
  const upcoming: Ticket[] = []
  const past: Ticket[] = []

  for (const ticket of tickets) {
    const start = new Date(ticket.startsAt ?? "").getTime()
    if (Number.isFinite(start) && start < now) past.push(ticket)
    else upcoming.push(ticket)
  }

  return { upcoming, past }
}

/** الحقول المرجعية التي يجب أن تأتي دائمًا من قاعدة البيانات (مصدر الحقيقة). */
const SERVER_AUTHORITATIVE_FIELDS = [
  "status",
  "ticketImageUrl",
  "receiptImage",
  "senderPhone",
  "telegramChatId",
  "verifiedAt",
  "verifiedVia",
  "checkedInAt",
] as const

/**
 * يدمج تذكرة السيرفر في نظيرتها المحلية:
 * - الحالة ورابط صورة التذكرة (`ticket_image_url`) وبقية الحقول المرجعية من **السيرفر**.
 * - البيانات العرضية (العرض، المكان، الموعد، المقاعد، البوستر…) من **المحلي** لأن
 *   جدول `tickets` لا يخزّنها — وهذا ما كان يجعل البطاقة تظهر فارغة سابقًا.
 */
export function mergeTicketRecords(local: Ticket, server: Ticket): Ticket {
  const merged: Ticket = { ...local }

  for (const field of SERVER_AUTHORITATIVE_FIELDS) {
    const value = server[field]
    if (value === undefined || value === null || value === "") continue
    // الحقول المرجعية تُطبَّع (تفهم approved/ACTIVE/confirmed).
    if (field === "status") merged.status = normalizeTicketStatus(value)
    else Object.assign(merged, { [field]: value })
  }

  // إكمال العرض من السيرفر عند غيابه محليًا (مثل تذكرة أُنشئت من جهاز آخر).
  merged.showTitle = merged.showTitle || server.showTitle
  merged.venue = merged.venue || server.venue
  merged.startsAt = merged.startsAt || server.startsAt
  merged.startsAtIso = merged.startsAtIso || server.startsAtIso
  merged.seats = merged.seats.length > 0 ? merged.seats : server.seats
  merged.tierName = merged.tierName || server.tierName
  merged.totalCents = merged.totalCents || server.totalCents
  merged.posterUrl = merged.posterUrl ?? server.posterUrl
  merged.paymentMethod = merged.paymentMethod || server.paymentMethod
  merged.paymentRef = merged.paymentRef || server.paymentRef
  merged.customerName = merged.customerName || server.customerName
  merged.customerId = merged.customerId || server.customerId

  return merged
}

/**
 * يدمج قائمة تذاكر السيرفر مع المخزن المحلي بلا تكرار:
 * السيرفر أولًا (مرجعي) ثم المحلي غير الموجود.
 */
export function mergeTicketSources(serverTickets: Ticket[], localTickets: Ticket[]): Ticket[] {
  const localById = new Map(localTickets.map((ticket) => [ticket.id, ticket]))
  const merged = new Map<string, Ticket>()

  for (const server of serverTickets) {
    const local = localById.get(server.id)
    merged.set(server.id, local ? mergeTicketRecords(local, server) : server)
  }
  for (const local of localTickets) {
    if (!merged.has(local.id)) merged.set(local.id, local)
  }

  return Array.from(merged.values()).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
}

function mutateTickets(updater: (current: Ticket[]) => Ticket[]): void {
  persistTickets(updater(readTickets()))
}

