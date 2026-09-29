"use client"

import { useSyncExternalStore } from "react"
import {
  clampPercent,
  remainingCouponUses,
  validateCouponRules,
  type CouponContext,
  type CouponRuleLike,
  type CouponScope,
  type CouponStatus,
  type CouponValidation,
  type ServiceFeeMode,
} from "@/lib/coupon-pricing"

/**
 * يُعاد تصدير أدوات الحساب النقي حتى يبقى `@/lib/coupons` هو **مدخل الكوبونات الوحيد**
 * للواجهات (نفس أسلوب `lib/session` مع `lib/roles` و`lib/tickets` مع `lib/ticket-status`).
 */
export type {
  CouponContext,
  CouponPriceShape,
  CouponRuleLike,
  CouponScopeKind,
  CouponValidation,
  CouponValidationReason,
} from "@/lib/coupon-pricing"
export { clampPercent, couponPriceShape, couponScopeMatches, validateCouponRules } from "@/lib/coupon-pricing"
export type { CouponScope, CouponStatus, ServiceFeeMode } from "@/lib/coupon-pricing"

/**
 * مولّد ومتتبّع **كوبونات الخصم** (Coupon Center).
 *
 * غرفة العمليات `/hq-kawalees` تولّد الكوبون وتحدّد نسبة الخصم ووضع رسوم الخدمة
 * (بلا / نفس النسبة / إعفاء كامل)، وصفحة الحجز تقرأ الكود وتطبّقه على الأسعار.
 * وكوبون «المهرجان المجاني» = `SERVICE_FEE_MODE` = `waived` مع نسبة 100% — بضغطة واحدة.
 *
 * المخزن محلي على نفس نمط باقي مخازن المنصة (`lib/invite-codes.ts`):
 * محاكاة ثم ربط بجدول `public.coupons` لاحقًا بدون تغيير أي واجهة.
 */

export type Coupon = CouponRuleLike & {
  code: string
  /** اسم الحملة المعروض للجمهور («مهرجان الطليعة 2026»). */
  label: string
  discountPct: number
  serviceFeeMode: ServiceFeeMode
  status: CouponStatus
  usedCount: number
  /** الحدود مُلزمة هنا (القيمة 0 = بلا حد) حتى لا تحتاج الواجهة لفحص `undefined`. */
  maxUses: number
  maxUsesPerCustomer: number
  maxDiscountCents: number
  createdAt: string
  /** بريد مُنشئ الكوبون (سوبر أدمن). */
  createdBy: string
  note?: string
  scope: CouponScope
}

export type CouponRedemption = {
  code: string
  ticketId: string
  customerId: string
  discountCents: number
  serviceFeeSavingCents: number
  totalCents: number
  at: string
}

export type CouponsState = {
  coupons: Coupon[]
  redemptions: CouponRedemption[]
}

export const COUPONS_STORAGE_KEY = "kawalees:coupons"
export const COUPONS_CHANGE_EVENT = "kawalees:coupons-change"

export const SERVICE_FEE_MODE_LABELS: Record<ServiceFeeMode, string> = {
  none: "بلا خصم على رسوم الخدمة",
  same: "نفس نسبة الخصم على رسوم الخدمة",
  waived: "رسوم الخدمة مجانًا (Free)",
}

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  active: "نشِط",
  disabled: "موقوف",
  expired: "منتهي",
  exhausted: "مستهلك",
}

export const COUPON_STATUS_TONES: Record<CouponStatus, "green" | "amber" | "red" | "gray"> = {
  active: "green",
  disabled: "red",
  expired: "gray",
  exhausted: "gray",
}

export const COUPON_SCOPE_LABELS: Record<CouponScope["kind"], string> = {
  all: "كل العروض",
  event: "عروض محددة",
  troupe: "فرق محددة",
  venue: "مسارح محددة",
}

/** كوبون «مهرجان مجاني» الجاهز: 100% على التذاكر + رسوم الخدمة مجانًا + استخدام واحد للعميل. */
export const FREE_FESTIVAL_PRESET = {
  discountPct: 100,
  serviceFeeMode: "waived" as ServiceFeeMode,
  maxUsesPerCustomer: 1,
}

/** نِسب سريعة في واجهة الإنشاء. */
export const COUPON_QUICK_PERCENTS = [10, 25, 50, 74, 100] as const

const YEAR = new Date().getFullYear()

export function seedCoupons(): CouponsState {
  return {
    coupons: [
      {
        code: `FEST-${YEAR}-100`,
        label: "مهرجان الطليعة — دخول مجاني للفرق المشاركة",
        discountPct: 100,
        serviceFeeMode: "waived",
        maxUses: 0,
        maxUsesPerCustomer: 1,
        maxDiscountCents: 0,
        scope: { kind: "all", ids: [] },
        status: "active",
        usedCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: "hq@kawalees.test",
        note: "الكوبون المرجعي للمهرجانات المجانية",
      },
      {
        code: `KAWALEES-${YEAR}-50`,
        label: "خصم نص التذاكر",
        discountPct: 50,
        serviceFeeMode: "none",
        maxUses: 100,
        maxUsesPerCustomer: 2,
        maxDiscountCents: 0,
        scope: { kind: "all", ids: [] },
        status: "active",
        usedCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: "hq@kawalees.test",
      },
    ],
    redemptions: [],
  }
}

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

/** يوحّد شكل الكوبون القادم من التخزين (بيانات قديمة/ناقصة لا تُسقط الواجهة). */
function normalizeCoupon(raw: Partial<Coupon>): Coupon {
  const status: CouponStatus =
    raw.status === "disabled" || raw.status === "expired" || raw.status === "exhausted" ? raw.status : "active"
  const serviceFeeMode: ServiceFeeMode =
    raw.serviceFeeMode === "same" || raw.serviceFeeMode === "waived" ? raw.serviceFeeMode : "none"
  const scopeKind = raw.scope?.kind
  const scope: CouponScope =
    scopeKind === "event" || scopeKind === "troupe" || scopeKind === "venue"
      ? { kind: scopeKind, ids: Array.isArray(raw.scope?.ids) ? raw.scope!.ids.map(Number) : [] }
      : { kind: "all", ids: [] }

  return {
    code: String(raw.code ?? "").trim().toUpperCase(),
    label: typeof raw.label === "string" ? raw.label : "",
    discountPct: clampPercent(raw.discountPct),
    serviceFeeMode,
    maxUses: Number.isFinite(raw.maxUses) ? Math.max(0, Math.floor(raw.maxUses as number)) : 0,
    maxUsesPerCustomer: Number.isFinite(raw.maxUsesPerCustomer)
      ? Math.max(0, Math.floor(raw.maxUsesPerCustomer as number))
      : 0,
    maxDiscountCents: Number.isFinite(raw.maxDiscountCents)
      ? Math.max(0, Math.round(raw.maxDiscountCents as number))
      : 0,
    scope,
    startsAt: typeof raw.startsAt === "string" ? raw.startsAt : undefined,
    endsAt: typeof raw.endsAt === "string" ? raw.endsAt : undefined,
    status,
    usedCount: Number.isFinite(raw.usedCount) ? Math.max(0, Math.floor(raw.usedCount as number)) : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "",
    note: typeof raw.note === "string" && raw.note.trim().length > 0 ? raw.note : undefined,
  }
}

function parseCoupons(raw: string | null): CouponsState {
  if (!raw) return seedCoupons()
  try {
    const parsed = JSON.parse(raw) as Partial<CouponsState> | null
    if (!parsed || typeof parsed !== "object") return seedCoupons()
    const coupons = Array.isArray(parsed.coupons)
      ? parsed.coupons
          .filter((item) => item && typeof (item as Partial<Coupon>).code === "string")
          .map((item) => normalizeCoupon(item as Partial<Coupon>))
      : []
    const redemptions = Array.isArray(parsed.redemptions)
      ? (parsed.redemptions as CouponRedemption[]).filter((item) => item && typeof item.code === "string")
      : []
    return { coupons, redemptions }
  } catch {
    return seedCoupons()
  }
}

let cachedRaw: string | null | undefined
let cachedState: CouponsState = seedCoupons()

/** كل الكوبونات وسجل الاستخدام (وعلى السيرفر: البيانات الأولية). */
export function readCoupons(): CouponsState {
  if (typeof window === "undefined") return cachedState
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(COUPONS_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = parseCoupons(raw)
  }
  return cachedState
}

function persistCoupons(state: CouponsState): void {
  cachedState = state
  if (typeof window === "undefined") return
  const raw = JSON.stringify(state)
  try {
    window.localStorage.setItem(COUPONS_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(COUPONS_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(COUPONS_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(COUPONS_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): CouponsState => cachedState

/** حالة الكوبونات الحيّة — متزامنة بين لوحة العمليات وصفحة الحجز. */
export function useCoupons(): CouponsState {
  return useSyncExternalStore(subscribe, readCoupons, getServerSnapshot)
}

export function getCoupons(): Coupon[] {
  return readCoupons().coupons
}

/** يبحث عن كوبون بكوده (بلا حساسية لحالة الأحرف). */
export function findCoupon(code: string): Coupon | null {
  const target = code.trim().toUpperCase()
  if (target.length === 0) return null
  return readCoupons().coupons.find((item) => item.code === target) ?? null
}

/* ---------- التوليد والإنشاء والتعديل ---------- */

/** مقطع عشوائي قصير بأحرف كبيرة وأرقام (بلا أحرف متشابهة). */
function randomBlock(length = 3): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
}

/** يبني كودًا بصيغة `FEST-2026-X8Y` أو `KAWALEES-2026-123`. */
export function buildCouponCode(prefix = "FEST", suffix?: string): string {
  const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "FEST"
  return `${clean}-${YEAR}-${suffix ?? randomBlock()}`
}

/** كود فريد غير مستخدم سابقًا. */
export function generateCouponCode(prefix = "FEST"): string {
  const existing = new Set(readCoupons().coupons.map((item) => item.code))
  let code = buildCouponCode(prefix)
  let guard = 0
  while (existing.has(code) && guard < 20) {
    code = buildCouponCode(prefix)
    guard += 1
  }
  return code
}

export type CreateCouponInput = {
  code?: string
  label: string
  discountPct: number
  serviceFeeMode: ServiceFeeMode
  maxUses?: number
  maxUsesPerCustomer?: number
  maxDiscountCents?: number
  scope?: CouponScope
  startsAt?: string
  endsAt?: string
  note?: string
  createdBy?: string
}

/**
 * إنشاء كوبون جديد. يرفض الكود القصير أو المكرر — ولو لم يُمرَّر كود يولّد واحدًا تلقائيًا.
 */
export function createCoupon(input: CreateCouponInput): Coupon | null {
  const label = input.label.trim()
  if (label.length < 2) return null

  const code = (input.code?.trim().toUpperCase() || generateCouponCode(prefixFromLabel(label))).slice(0, 40)
  if (code.length < 4) return null
  if (readCoupons().coupons.some((item) => item.code === code)) return null

  const coupon = normalizeCoupon({
    code,
    label,
    discountPct: input.discountPct,
    serviceFeeMode: input.serviceFeeMode,
    maxUses: input.maxUses ?? 0,
    maxUsesPerCustomer: input.maxUsesPerCustomer ?? 0,
    maxDiscountCents: input.maxDiscountCents ?? 0,
    scope: input.scope ?? { kind: "all", ids: [] },
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: "active",
    usedCount: 0,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? "",
    note: input.note,
  })

  const state = readCoupons()
  persistCoupons({ ...state, coupons: [coupon, ...state.coupons] })
  return coupon
}

/** بادئة الكود من اسم الحملة (أول كلمة لاتينية، وإلا FEST). */
function prefixFromLabel(label: string): string {
  const latin = label
    .split(/\s+/)
    .find((word) => /^[A-Za-z0-9-]{3,}$/.test(word))
  return latin ? latin.toUpperCase() : "FEST"
}

/** تعديل جزئي لكوبون (النسبة/رسوم الخدمة/الحدود/التواريخ/الملاحظة). */
export function updateCoupon(code: string, patch: Partial<Omit<Coupon, "code" | "createdAt">>): void {
  const target = code.trim().toUpperCase()
  const state = readCoupons()
  persistCoupons({
    ...state,
    coupons: state.coupons.map((item) =>
      item.code === target ? normalizeCoupon({ ...item, ...patch, code: item.code }) : item,
    ),
  })
}

/** إيقاف/تفعيل كوبون. */
export function setCouponStatus(code: string, status: Exclude<CouponStatus, "expired" | "exhausted">): void {
  updateCoupon(code, { status })
}

/** حذف كوبون نهائيًا (يبقى سجل استخداماته في `redemptions`). */
export function removeCoupon(code: string): void {
  const target = code.trim().toUpperCase()
  const state = readCoupons()
  persistCoupons({ ...state, coupons: state.coupons.filter((item) => item.code !== target) })
}

/** إعادة تعيين مركز الكوبونات إلى البيانات الأولية (للاختبار/العرض). */
export function resetCoupons(): void {
  persistCoupons(seedCoupons())
}

/* ---------- الاستخدام والتحقق ---------- */

/** أقصى عدد سجلات استخدام نحتفظ بها (حماية حجم التخزين المحلي). */
const MAX_REDEMPTIONS = 300

/** عدد مرات استخدام هذا العميل لهذا الكود. */
export function customerCouponUses(code: string, customerId: string): number {
  const target = code.trim().toUpperCase()
  const customer = customerId.trim().toLowerCase()
  if (customer.length === 0) return 0
  return readCoupons().redemptions.filter(
    (item) => item.code === target && item.customerId.trim().toLowerCase() === customer,
  ).length
}

/** عدد الاستخدامات المتبقية للكوبون (بلا حد = Infinity). */
export function couponRemainingUses(coupon: Coupon): number {
  return remainingCouponUses(coupon)
}

export type CouponLookup = CouponValidation & { coupon: Coupon | null }

/**
 * التحقق من كود كوبون: موجود؟ نشِط؟ داخل مدته؟ لم يُستهلك؟ داخل نطاق هذا العرض؟
 * (المنطق الفعلي في `lib/coupon-pricing:validateCouponRules` — وهنا نضيف قراءة السجل).
 */
export function validateCoupon(code: string, context: CouponContext = {}): CouponLookup {
  const target = code.trim().toUpperCase()
  if (target.length === 0) {
    return { ok: false, coupon: null, message: "أدخل كود الكوبون.", reason: "empty" }
  }

  const coupon = findCoupon(target)
  if (!coupon) {
    return { ok: false, coupon: null, message: "الكود غير معروف — راجع الكود من جديد.", reason: "unknown" }
  }

  const uses = context.customerUses ?? customerCouponUses(target, context.customerId ?? "")
  const result = validateCouponRules(coupon, { ...context, customerUses: uses })
  return { ...result, coupon }
}

export type RedeemCouponInput = {
  ticketId: string
  customerId: string
  discountCents: number
  serviceFeeSavingCents: number
  totalCents: number
}

/** يسجّل استخدام الكوبون مرة واحدة ويزيد عدّاده (ويتحول إلى «مستهلك» عند بلوغ السقف). */
export function redeemCoupon(code: string, input: RedeemCouponInput): void {
  const target = code.trim().toUpperCase()
  const state = readCoupons()
  const exists = state.coupons.some((item) => item.code === target)
  if (!exists) return

  const redemption: CouponRedemption = {
    code: target,
    ticketId: input.ticketId,
    customerId: input.customerId.trim().toLowerCase(),
    discountCents: Math.max(0, Math.round(input.discountCents)),
    serviceFeeSavingCents: Math.max(0, Math.round(input.serviceFeeSavingCents)),
    totalCents: Math.max(0, Math.round(input.totalCents)),
    at: new Date().toISOString(),
  }

  persistCoupons({
    coupons: state.coupons.map((item) => {
      if (item.code !== target) return item
      const usedCount = item.usedCount + 1
      const max = item.maxUses ?? 0
      const exhausted = max > 0 && usedCount >= max
      return { ...item, usedCount, status: exhausted ? "exhausted" : item.status }
    }),
    redemptions: [redemption, ...state.redemptions].slice(0, MAX_REDEMPTIONS),
  })
}

export type CouponStats = {
  total: number
  active: number
  disabled: number
  used: number
  /** إجمالي ما وفّره الكوبونات للجمهور (تذاكر + رسوم خدمة). */
  totalDiscountCents: number
  totalServiceFeeSavingCents: number
  redemptions: number
}

/** إحصاء سريع لمركز الكوبونات (يُغذّي كروت KPI). */
export function couponStats(state: CouponsState = readCoupons()): CouponStats {
  return {
    total: state.coupons.length,
    active: state.coupons.filter((item) => item.status === "active").length,
    disabled: state.coupons.filter((item) => item.status === "disabled").length,
    used: state.coupons.filter((item) => (item.usedCount ?? 0) > 0).length,
    totalDiscountCents: state.redemptions.reduce((sum, item) => sum + item.discountCents, 0),
    totalServiceFeeSavingCents: state.redemptions.reduce((sum, item) => sum + item.serviceFeeSavingCents, 0),
    redemptions: state.redemptions.length,
  }
}

/** سجل استخدام كوبون واحد (الأحدث أولًا). */
export function couponRedemptions(code: string): CouponRedemption[] {
  const target = code.trim().toUpperCase()
  return readCoupons().redemptions.filter((item) => item.code === target)
}



