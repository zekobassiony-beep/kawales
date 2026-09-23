"use client"

import { useSyncExternalStore } from "react"
import { sendTelegramNotification } from "@/lib/telegram"

/**
 * منظومة التذاكر والمدفوعات المباشرة (Checkout & Direct Payment Gateway).
 *
 * لا يوجد جدول تذاكر في قاعدة البيانات بعد (نفس أسلوب باقي اللوحات:
 * محاكاة ثم ربط حقيقي)، لذا تُخزَّن التذاكر في `localStorage` ويقرأها
 * كل من صفحة الحجز ولوحة العميل عبر `useTickets()` أو القراءات المباشرة.
 */

export type TicketStatus = "pending" | "approved" | "rejected" | "checked_in"
/** معرّف وسيلة الدفع — نص حر لأن الوسائل تُدار ديناميكيًا من لوحة العمليات. */
export type PaymentMethod = string
/** معرّفات وسائل الدفع الافتراضية. */
export const DEFAULT_PAYMENT_METHOD_ID = "vodafone_cash"
/** مصدر اعتماد التحويل: أوتوميشن بوت التليجرام، أو رسالة SMS، أو بوابة دفع. */
export type VerificationChannel = "telegram" | "sms" | "gateway"

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
  paymentMethod: PaymentMethod
  paymentRef: string
  status: TicketStatus
  /** رابط/Base64 لصورة إيصال التحويل المرفقة. */
  receiptImage?: string
  /** رقم الموبايل الذي تم التحويل منه. */
  senderPhone?: string
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
}

/** اسم وسيلة الدفع المعروض للجمهور — يرجع للمعرّف إن كانت وسيلة مضافة حديثًا. */
export function paymentMethodLabel(id: string): string {
  return PAYMENT_METHOD_LABELS[id] ?? id
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "قيد مراجعة الإيصال",
  approved: "مقبول — QR فعّال",
  rejected: "مرفوض",
  checked_in: "تم الحضور — مسحت عند البوابة",
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
    `مرجع التحويل: ${ticket.paymentRef}`,
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
  sendTelegramNotification(
    `🎭 تذكرة جديدة — كواليس\n🎟️ ${ticket.id}\n📌 ${ticket.showTitle}\n👤 ${ticket.customerName}\n💺 ${ticket.seats.join("، ")}\n💳 ${paymentMethodLabel(ticket.paymentMethod)}\n💰 ${formatPiastres(ticket.totalCents)}`,
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
 * نبضة تحقق دورية للانتظار الأنيق: تفحص تحديث الأوتوميشن من التخزين المحلي
 * (وكذلك أي تحديث يصل من تبويب آخر) وتُعيد دالة إيقاف النبضة.
 */
export function startTicketStatusPolling(intervalMs = 4000): () => void {
  if (typeof window === "undefined") return () => undefined
  const timer = window.setInterval(() => {
    // أي تغيير في التخزين يُطلق حدث المتجر ويُحدّث الحالة المعلّقة تلقائيًا.
    window.dispatchEvent(new Event(TICKETS_CHANGE_EVENT))
  }, intervalMs)
  return () => window.clearInterval(timer)
}

/** عدد التذاكر المعلّقة على مراجعة الإيصال لمستخدم واحد. */
export function pendingReviewCount(customerId: string): number {
  return getTicketsForUser(customerId).filter((ticket) => ticket.status === "pending").length
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

  if (ticket.status === "checked_in") {
    return {
      outcome: "already_used",
      ticket,
      checkedInAt: ticket.checkedInAt,
      message: `تنبيه: تم استخدام هذه التذكرة مسبقًا في تمام الساعة ${formatClock(ticket.checkedInAt)}.`,
    }
  }

  if (ticket.status !== "approved") {
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
  return readTickets().filter((ticket) => ticket.showId === String(showId) && ticket.status === "checked_in")
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
  return readTickets().filter((ticket) => ticket.status === "approved")
}

/** تقسيم تذاكر المستخدم إلى قادمة (حسب موعد العرض) وسابقة. */
export function splitTickets(tickets: Ticket[], now = Date.now()): { upcoming: Ticket[]; past: Ticket[] } {
  return {
    upcoming: tickets.filter((ticket) => new Date(ticket.startsAt).getTime() >= now),
    past: tickets.filter((ticket) => new Date(ticket.startsAt).getTime() < now),
  }
}

function mutateTickets(updater: (current: Ticket[]) => Ticket[]): void {
  persistTickets(updater(readTickets()))
}

