"use client"

import { useSyncExternalStore } from "react"

/**
 * مولّد ومتتبّع أكواد الدعوة للمسارح والفرق (Invite & Verification Center).
 *
 * لوحة التحكم العليا `/hq-kawalees` تولّد الأكواد وتتابع حالتها
 * (متاح / مستعمل) والجهة المخصصة لها، وصفحة `/onboarding` تتحقق منها.
 */

export type InviteCodeKind = "venue" | "troupe" | "vip"
export type InviteCodeStatus = "available" | "used" | "revoked"

export type InviteCode = {
  code: string
  kind: InviteCodeKind
  status: InviteCodeStatus
  /** الجهة المخصص لها الكود (اسم المسرح أو الفرقة أو الوصف). */
  label: string
  note?: string
  createdAt: string
  usedAt?: string
  usedBy?: string
}

export const INVITE_CODES_STORAGE_KEY = "kawalees:invite-codes"
export const INVITE_CODES_CHANGE_EVENT = "kawalees:invite-codes-change"

export const INVITE_KIND_LABELS: Record<InviteCodeKind, string> = {
  venue: "مدير مسرح",
  troupe: "فرقة / مخرج",
  vip: "دعوة خاصة",
}

export const INVITE_STATUS_LABELS: Record<InviteCodeStatus, string> = {
  available: "متاح",
  used: "مستعمل",
  revoked: "ملغي",
}

export const INVITE_STATUS_TONES: Record<InviteCodeStatus, "green" | "amber" | "red" | "gray"> = {
  available: "green",
  used: "gray",
  revoked: "red",
}

const KIND_PREFIX: Record<InviteCodeKind, string> = {
  venue: "VENUE",
  troupe: "TROUPE",
  vip: "VIP",
}

const YEAR = new Date().getFullYear()

export const SEED_INVITE_CODES: InviteCode[] = [
  {
    code: "KAWALEES-2026",
    kind: "venue",
    status: "available",
    label: "الرمز الافتراضي لمديري المسارح التجريبيين",
    note: "نفس الرمز المستخدم في /onboarding",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    code: `TROUPE-${YEAR}-VIP`,
    kind: "troupe",
    status: "used",
    label: "مسرح الحر المستقل",
    usedBy: "troupe@kawalees.test",
    usedAt: "2026-02-11T12:30:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
  },
]

/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parseInviteCodes(raw: string | null): InviteCode[] {
  if (!raw) return SEED_INVITE_CODES
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEED_INVITE_CODES
    const codes = (parsed as InviteCode[]).filter((item) => item && typeof item.code === "string")
    return codes.length > 0 ? codes : SEED_INVITE_CODES
  } catch {
    return SEED_INVITE_CODES
  }
}

let cachedRaw: string | null | undefined
let cachedCodes: InviteCode[] = SEED_INVITE_CODES

/** كل أكواد الدعوة (وعلى السيرفر: القائمة الأولية). */
export function readInviteCodes(): InviteCode[] {
  if (typeof window === "undefined") return SEED_INVITE_CODES
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(INVITE_CODES_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedCodes = parseInviteCodes(raw)
  }
  return cachedCodes
}

function persistInviteCodes(codes: InviteCode[]): void {
  if (typeof window === "undefined") return
  cachedCodes = codes
  const raw = JSON.stringify(codes)
  try {
    window.localStorage.setItem(INVITE_CODES_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(INVITE_CODES_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(INVITE_CODES_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(INVITE_CODES_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): InviteCode[] => SEED_INVITE_CODES

/** أكواد الدعوة الحيّة — متزامنة بين لوحة التحكم العليا وصفحة الدخول. */
export function useInviteCodes(): InviteCode[] {
  return useSyncExternalStore(subscribe, readInviteCodes, getServerSnapshot)
}


/* ---------- توليد الأكواد وتتبّع حالتها ---------- */

/** مقطع عشوائي قصير بأحرف كبيرة وأرقام (بلا أحرف متشابهة). */
function randomBlock(length = 3): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
}

/** يبني كودًا بصيغة `VENUE-2026-X8Y` أو `TROUPE-VIP-99`. */
export function buildInviteCode(kind: InviteCodeKind, suffix?: string): string {
  const prefix = KIND_PREFIX[kind]
  if (kind === "troupe") return `${prefix}-VIP-${suffix ?? String(Math.floor(Math.random() * 90) + 10)}`
  return `${prefix}-${YEAR}-${suffix ?? randomBlock()}`
}

/** كود فريد غير مستخدم سابقًا. */
export function generateInviteCode(kind: InviteCodeKind, label = "", note?: string): InviteCode {
  const existing = new Set(readInviteCodes().map((item) => item.code.toUpperCase()))
  let code = buildInviteCode(kind)
  let guard = 0
  while (existing.has(code.toUpperCase()) && guard < 20) {
    code = buildInviteCode(kind)
    guard += 1
  }
  const invite: InviteCode = {
    code,
    kind,
    status: "available",
    label: label.trim() || INVITE_KIND_LABELS[kind],
    note: note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  persistInviteCodes([invite, ...readInviteCodes()])
  return invite
}

/** إضافة كود مخصّص يدويًا (مثل KAWALEES-2026). */
export function addInviteCode(input: {
  code: string
  kind: InviteCodeKind
  label?: string
  note?: string
}): InviteCode | null {
  const code = input.code.trim().toUpperCase()
  if (code.length < 4) return null
  if (readInviteCodes().some((item) => item.code.toUpperCase() === code)) return null
  const invite: InviteCode = {
    code,
    kind: input.kind,
    status: "available",
    label: input.label?.trim() || INVITE_KIND_LABELS[input.kind],
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  persistInviteCodes([invite, ...readInviteCodes()])
  return invite
}

/** وسم الكود كمستعمل (عند إتمام تسجيل مسرح أو فرقة به). */
export function markInviteCodeUsed(code: string, usedBy: string): void {
  const target = code.trim().toUpperCase()
  persistInviteCodes(
    readInviteCodes().map((item) =>
      item.code.toUpperCase() === target
        ? { ...item, status: "used", usedBy: usedBy.trim(), usedAt: new Date().toISOString() }
        : item,
    ),
  )
}

/** إعادة الكود إلى «متاح» (تحرير الكود من جهة لم تكمل التسجيل). */
export function releaseInviteCode(code: string): void {
  const target = code.trim().toUpperCase()
  persistInviteCodes(
    readInviteCodes().map((item) =>
      item.code.toUpperCase() === target ? { ...item, status: "available", usedBy: undefined, usedAt: undefined } : item,
    ),
  )
}

/** إلغاء كود (لن يُقبل في التسجيل بعدها). */
export function revokeInviteCode(code: string): void {
  const target = code.trim().toUpperCase()
  persistInviteCodes(
    readInviteCodes().map((item) => (item.code.toUpperCase() === target ? { ...item, status: "revoked" } : item)),
  )
}

/** حذف كود نهائيًا. */
export function removeInviteCode(code: string): void {
  const target = code.trim().toUpperCase()
  persistInviteCodes(readInviteCodes().filter((item) => item.code.toUpperCase() !== target))
}

/** التحقق من كود عند التسجيل: المتاح فقط هو المقبول. */
export function validateInviteCode(code: string): { ok: boolean; invite: InviteCode | null; message: string } {
  const target = code.trim().toUpperCase()
  if (target.length === 0) return { ok: false, invite: null, message: "أدخل كود الدعوة." }
  const invite = readInviteCodes().find((item) => item.code.toUpperCase() === target) ?? null
  if (!invite) return { ok: false, invite: null, message: "كود الدعوة غير معروف." }
  if (invite.status === "used") return { ok: false, invite, message: "هذا الكود مستعمل بالفعل." }
  if (invite.status === "revoked") return { ok: false, invite, message: "هذا الكود ملغى من إدارة كواليس." }
  return { ok: true, invite, message: `كود صالح لـ${INVITE_KIND_LABELS[invite.kind]}.` }
}

/** كل الأكواد (بلا hook) — تُستعمل في شاشات التحقق. */
export function getInviteCodes(): InviteCode[] {
  return readInviteCodes()
}

/** إحصاء سريع لحالات الأكواد. */
export function inviteCodeStats(codes: InviteCode[] = readInviteCodes()) {
  return {
    total: codes.length,
    available: codes.filter((item) => item.status === "available").length,
    used: codes.filter((item) => item.status === "used").length,
    revoked: codes.filter((item) => item.status === "revoked").length,
  }
}
