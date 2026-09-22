"use client"

import { useSyncExternalStore } from "react"

/**
 * محرك وسائل الدفع الديناميكي (Dynamic Payment Methods).
 *
 * لوحة التحكم العليا `/hq-kawalees` تعدّل رقم فودافون كاش ومعرّف انستا باي
 * (أو تضيف وسيلة جديدة) فتنعكس التعديلات **لحظيًا** في صفحة الحجز، لأن الطرفين
 * يقرأان نفس المخزن المحلي (localStorage + useSyncExternalStore).
 */

export type PaymentMethodConfig = {
  /** معرّف تقني ثابت يُخزَّن على التذكرة (vodafone_cash، instapay، …). */
  id: string
  name: string
  /** رقم المحفظة أو معرّف IPA. */
  account: string
  /** ما يُطلب من العميل إدخاله في حقل المرجع. */
  referenceLabel: string
  instructions: string
  /** فئات Tailwind للهوية اللونية (تظهر في الزر الكبير أيضًا). */
  colorClass: string
  emoji: string
  /** رابط فتح التطبيق السريع (انستا باي مثلًا). */
  quickLinkUrl?: string
  quickLinkLabel?: string
  isActive: boolean
  updatedAt: string
}

export const PAYMENT_METHODS_STORAGE_KEY = "kawalees:payment-methods"
export const PAYMENT_METHODS_CHANGE_EVENT = "kawalees:payment-methods-change"

/** ألوان جاهزة للاختيار عند إضافة وسيلة دفع جديدة (فئات Tailwind ثابتة). */
export const PAYMENT_COLOR_PRESETS: { label: string; colorClass: string }[] = [
  { label: "أحمر فودافون", colorClass: "bg-red-600" },
  { label: "سماوي انستا باي", colorClass: "bg-sky-500" },
  { label: "أخضر", colorClass: "bg-emerald-600" },
  { label: "ذهبي كواليس", colorClass: "bg-amber-500" },
  { label: "بنفسجي", colorClass: "bg-violet-600" },
  { label: "رمادي داكن", colorClass: "bg-slate-700" },
]

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: "vodafone_cash",
    name: "فودافون كاش",
    account: "01000000000",
    referenceLabel: "رقم المحفظة المحوَّل منها / رقم عملية التحويل / المرجع",
    instructions: "أرسل المبلغ إلى محفظة فودافون كاش، ثم الصق رقم المحول أو رقم العملية وأرفق الإثبات عبر البوت.",
    colorClass: "bg-red-600",
    emoji: "🔴",
    isActive: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "instapay",
    name: "انستا باي (InstaPay)",
    account: "kawalees@instapay",
    referenceLabel: "رقم عملية التحويل / المرجع",
    instructions: "أرسل المبلغ إلى معرّف InstaPay التالي من تطبيقك، ثم الصق رقم العملية وأرفق الإثبات عبر البوت.",
    colorClass: "bg-sky-500",
    emoji: "🔷",
    quickLinkUrl: "https://installments.insta-pay.app/",
    quickLinkLabel: "افتح التطبيق",
    isActive: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parsePaymentMethods(raw: string | null): PaymentMethodConfig[] {
  if (!raw) return DEFAULT_PAYMENT_METHODS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_PAYMENT_METHODS
    const methods = (parsed as PaymentMethodConfig[]).filter(
      (method) => method && typeof method.id === "string" && typeof method.name === "string",
    )
    return methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS
  } catch {
    return DEFAULT_PAYMENT_METHODS
  }
}

let cachedRaw: string | null | undefined
let cachedMethods: PaymentMethodConfig[] = DEFAULT_PAYMENT_METHODS

/** قراءة وسائل الدفع الحالية (وعلى السيرفر: القيم الافتراضية). */
export function readPaymentMethods(): PaymentMethodConfig[] {
  if (typeof window === "undefined") return DEFAULT_PAYMENT_METHODS
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedMethods = parsePaymentMethods(raw)
  }
  return cachedMethods
}

function persistPaymentMethods(methods: PaymentMethodConfig[]): void {
  if (typeof window === "undefined") return
  cachedMethods = methods
  const raw = JSON.stringify(methods)
  try {
    window.localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(PAYMENT_METHODS_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(PAYMENT_METHODS_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(PAYMENT_METHODS_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): PaymentMethodConfig[] => DEFAULT_PAYMENT_METHODS

/** كل وسائل الدفع الحيّة — متزامنة بين لوحة التحكم العليا وصفحة الحجز. */
export function usePaymentMethods(): PaymentMethodConfig[] {
  return useSyncExternalStore(subscribe, readPaymentMethods, getServerSnapshot)
}

/* ---------- العمليات (تستعملها لوحة التحكم العليا وصفحة الحجز) ---------- */

/** كل وسائل الدفع (بما فيها المعطّلة) — قراءة فورية بلا hook. */
export function getPaymentMethods(): PaymentMethodConfig[] {
  return readPaymentMethods()
}

/** الوسائل المفعّلة فقط — هي التي تعرضها صفحة الحجز للجمهور. */
export function activePaymentMethods(): PaymentMethodConfig[] {
  const active = readPaymentMethods().filter((method) => method.isActive)
  return active.length > 0 ? active : readPaymentMethods().slice(0, 1)
}

/** وسيلة دفع واحدة بالمعرّف. */
export function paymentMethodById(id: string): PaymentMethodConfig | undefined {
  return readPaymentMethods().find((method) => method.id === id)
}

/** لون هوية الوسيلة (يُستعمل في الزر الكبير لبطاقة التذكرة). */
export function paymentMethodColorClass(id: string, fallback = "bg-primary"): string {
  return paymentMethodById(id)?.colorClass ?? fallback
}

/** اسم الوسيلة المعروض للجمهور (يقع رجوعًا للمعرّف عند حذف الوسيلة). */
export function paymentMethodName(id: string): string {
  return paymentMethodById(id)?.name ?? id
}

/** تعديل بيانات وسيلة دفع قائمة (الرقم، المعرف، التعليمات، اللون…). */
export function updatePaymentMethod(id: string, patch: Partial<Omit<PaymentMethodConfig, "id">>): void {
  persistPaymentMethods(
    readPaymentMethods().map((method) =>
      method.id === id ? { ...method, ...patch, id: method.id, updatedAt: new Date().toISOString() } : method,
    ),
  )
}

export type NewPaymentMethodInput = {
  name: string
  account: string
  referenceLabel?: string
  instructions?: string
  colorClass?: string
  emoji?: string
  quickLinkUrl?: string
  quickLinkLabel?: string
  isActive?: boolean
}

/** إضافة وسيلة دفع جديدة (مع توليد معرّف تقني من الاسم). */
export function addPaymentMethod(input: NewPaymentMethodInput): PaymentMethodConfig {
  const id = uniqueMethodId(input.name)
  const method: PaymentMethodConfig = {
    id,
    name: input.name.trim(),
    account: input.account.trim(),
    referenceLabel: input.referenceLabel?.trim() || "رقم عملية التحويل / المرجع",
    instructions: input.instructions?.trim() || "أرسل المبلغ ثم أرفق إثبات التحويل عبر بوت كواليس.",
    colorClass: input.colorClass || PAYMENT_COLOR_PRESETS[0].colorClass,
    emoji: input.emoji?.trim() || "💳",
    quickLinkUrl: input.quickLinkUrl?.trim() || undefined,
    quickLinkLabel: input.quickLinkLabel?.trim() || undefined,
    isActive: input.isActive ?? true,
    updatedAt: new Date().toISOString(),
  }
  persistPaymentMethods([...readPaymentMethods(), method])
  return method
}

/** تفعيل/تعطيل وسيلة دفع مؤقتًا (بلا حذف) — ينعكس لحظيًا في صفحة الحجز. */
export function togglePaymentMethod(id: string, isActive?: boolean): void {
  const current = paymentMethodById(id)
  if (!current) return
  updatePaymentMethod(id, { isActive: isActive ?? !current.isActive })
}

/** حذف وسيلة دفع نهائيًا. */
export function removePaymentMethod(id: string): void {
  persistPaymentMethods(readPaymentMethods().filter((method) => method.id !== id))
}

/** استرجاع الوسائل الافتراضية (فودافون كاش + انستا باي). */
export function resetPaymentMethods(): void {
  persistPaymentMethods(DEFAULT_PAYMENT_METHODS)
}

/** توليد معرّف تقني فريد من اسم الوسيلة (لاتيني صغير بدون رموز). */
function uniqueMethodId(name: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "_")
      .replace(/^_+|_+$/g, "") || "method"
  const existing = new Set(readPaymentMethods().map((method) => method.id))
  if (!existing.has(base)) return base
  let counter = 2
  while (existing.has(`${base}_${counter}`)) counter += 1
  return `${base}_${counter}`
}

