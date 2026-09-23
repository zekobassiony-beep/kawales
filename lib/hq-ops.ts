"use client"

import { useSyncExternalStore } from "react"

/**
 * عمليات غرفة كواليس (HQ Operations): طلبات انضمام الفرق والمسارح، طلبات سحب
 * الأرباح، والبلاغات العاجلة — مخزن محلي على نفس نمط باقي مخازن المنصة
 * (محاكاة ثم ربط حقيقي)، لتشتغل أزرار القرار فعليًا في لوحة السوبر أدمن.
 */

export type JoinRequestStatus = "pending" | "approved" | "rejected"
export type PayoutStatus = "pending" | "approved" | "on_hold"
export type AlertStatus = "open" | "resolved"
export type HQPartyKind = "venue" | "troupe"
export type AlertSeverity = "high" | "medium" | "low"

export type HQJoinRequest = {
  id: string
  name: string
  kind: HQPartyKind
  city: string
  email: string
  submittedAt: string
  status: JoinRequestStatus
  note: string
}

export type HQPayout = {
  id: string
  party: string
  kind: HQPartyKind
  amountCents: number
  method: string
  requestedAt: string
  status: PayoutStatus
}

export type HQAlert = {
  id: string
  title: string
  detail: string
  severity: AlertSeverity
  createdAt: string
  status: AlertStatus
}

export type HQOpsState = {
  joinRequests: HQJoinRequest[]
  payouts: HQPayout[]
  alerts: HQAlert[]
}

export const HQ_OPS_STORAGE_KEY = "kawalees:hq-ops"
export const HQ_OPS_CHANGE_EVENT = "kawalees:hq-ops-change"

export const JOIN_STATUS_LABELS: Record<JoinRequestStatus, string> = {
  pending: "بانتظار القرار",
  approved: "مقبول ومفعّل",
  rejected: "مرفوض",
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: "بانتظار الاعتماد",
  approved: "تم اعتماد السداد",
  on_hold: "معلّق للمراجعة",
}

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: "مفتوح",
  resolved: "تمت المعالجة",
}

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  high: "حرج",
  medium: "متوسط",
  low: "منخفض",
}

export const HQ_KIND_LABELS: Record<HQPartyKind, string> = {
  venue: "مسرح",
  troupe: "فرقة",
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/** بيانات تشغيلية أولية واقعية (تُستبدل بجدول حقيقي عند ربطه). */
export function seedHqOps(): HQOpsState {
  return {
    joinRequests: [
      {
        id: "join-1",
        name: "مسرح الطليعة الجديد",
        kind: "venue",
        city: "الإسكندرية",
        email: "taliaa@kawalees.test",
        submittedAt: daysAgo(1),
        status: "pending",
        note: "قاعة 180 مقعدًا + بنوار، تطلب تسجيلًا موثقًا.",
      },
      {
        id: "join-2",
        name: "فرقة الموجة الحرة",
        kind: "troupe",
        city: "أسوان",
        email: "mawja@kawalees.test",
        submittedAt: daysAgo(2),
        status: "pending",
        note: "ثلاث مسرحيات جاهزة للموسم القادم.",
      },
      {
        id: "join-3",
        name: "مركز سوهاج الثقافي",
        kind: "venue",
        city: "سوهاج",
        email: "sohag@kawalees.test",
        submittedAt: daysAgo(5),
        status: "approved",
        note: "تم التحقق من المستندات.",
      },
    ],
    payouts: [
      { id: "pay-1", party: "فرقة القهوة", kind: "troupe", amountCents: 1_250_000, method: "فودافون كاش", requestedAt: daysAgo(1), status: "pending" },
      { id: "pay-2", party: "مسرح الأندلس", kind: "venue", amountCents: 860_000, method: "انستا باي", requestedAt: daysAgo(3), status: "pending" },
      { id: "pay-3", party: "فرقة النجوم", kind: "troupe", amountCents: 430_000, method: "تحويل بنكي", requestedAt: daysAgo(6), status: "on_hold" },
    ],
    alerts: [
      { id: "al-1", title: "تعارض في حجز القاعة", detail: "مسرح الأندلس: حجزَان متزامنان على القاعة الرئيسية يوم ١٢.", severity: "high", createdAt: daysAgo(0.2), status: "open" },
      { id: "al-2", title: "بوابة الدفع: إيصال مشبوه", detail: "إيصال مكرر لنفس رقم التحويل على تذكرتين مختلفتين.", severity: "high", createdAt: daysAgo(1), status: "open" },
      { id: "al-3", title: "إيصال غير واضح", detail: "صورة إيصال منخفضة الجودة تحتاج إعادة إرسال.", severity: "medium", createdAt: daysAgo(2), status: "open" },
      { id: "al-4", title: "بوت التليجرام: تأخر استجابة", detail: "تأخر مؤقت في وصول إشعارات الحجز (تمت المعالجة).", severity: "low", createdAt: daysAgo(4), status: "resolved" },
    ],
  }
}

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parseHqOps(raw: string | null): HQOpsState {
  if (!raw) return seedHqOps()
  try {
    const parsed = JSON.parse(raw) as Partial<HQOpsState>
    if (!parsed || typeof parsed !== "object") return seedHqOps()
    return {
      joinRequests: Array.isArray(parsed.joinRequests) ? parsed.joinRequests : [],
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    }
  } catch {
    return seedHqOps()
  }
}

let cachedRaw: string | null | undefined
let cachedState: HQOpsState = seedHqOps()

/** قراءة عمليات HQ من التخزين المحلي (وعلى السيرفر: البيانات الأولية). */
export function readHqOps(): HQOpsState {
  if (typeof window === "undefined") return cachedState
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(HQ_OPS_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = parseHqOps(raw)
  }
  return cachedState
}

function persistHqOps(state: HQOpsState): void {
  cachedState = state
  if (typeof window === "undefined") return
  const raw = JSON.stringify(state)
  try {
    window.localStorage.setItem(HQ_OPS_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(HQ_OPS_CHANGE_EVENT))
}

function mutate(updater: (current: HQOpsState) => HQOpsState): void {
  persistHqOps(updater(readHqOps()))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(HQ_OPS_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(HQ_OPS_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

/** حالة عمليات HQ الحيّة (متزامنة بين كل المكوّنات). */
export function useHqOps(): HQOpsState {
  return useSyncExternalStore(subscribe, readHqOps, () => cachedState)
}

/* ---------- القرارات ---------- */

/** قرار على طلب انضمام: قبول وتفعيل أو رفض. */
export function decideJoinRequest(id: string, status: Exclude<JoinRequestStatus, "pending">): void {
  mutate((current) => ({
    ...current,
    joinRequests: current.joinRequests.map((item) => (item.id === id ? { ...item, status } : item)),
  }))
}

/** قرار على طلب سحب أرباح: اعتماد السداد أو تعليق للمراجعة. */
export function decidePayout(id: string, status: Exclude<PayoutStatus, "pending">): void {
  mutate((current) => ({
    ...current,
    payouts: current.payouts.map((item) => (item.id === id ? { ...item, status } : item)),
  }))
}

/** معالجة بلاغ/تنبيه. */
export function resolveAlert(id: string, status: AlertStatus = "resolved"): void {
  mutate((current) => ({
    ...current,
    alerts: current.alerts.map((item) => (item.id === id ? { ...item, status } : item)),
  }))
}

/** إعادة تعيين العمليات إلى البيانات الأولية (للاختبار/العرض). */
export function resetHqOps(): void {
  persistHqOps(seedHqOps())
}

export type HQOpsStats = {
  pendingJoins: number
  pendingPayouts: number
  openAlerts: number
  pendingPayoutCents: number
  urgentTotal: number
}

/** إحصاء سريع للعمليات المعلّقة (يُغذّي مؤشر «تتطلب إجراءً عاجلًا»). */
export function hqOpsStats(state: HQOpsState): HQOpsStats {
  const pendings = state.payouts.filter((item) => item.status === "pending")
  return {
    pendingJoins: state.joinRequests.filter((item) => item.status === "pending").length,
    pendingPayouts: pendings.length,
    openAlerts: state.alerts.filter((item) => item.status === "open").length,
    pendingPayoutCents: pendings.reduce((sum, item) => sum + item.amountCents, 0),
    urgentTotal:
      state.joinRequests.filter((item) => item.status === "pending").length +
      pendings.length +
      state.alerts.filter((item) => item.status === "open").length,
  }
}

