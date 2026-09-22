"use client"

import { useSyncExternalStore } from "react"

/**
 * شارات التوثيق (Verified Badges): يمنحها/يسحبها فريق كواليس من لوحة التحكم
 * العليا للممثلين والفرق والمسارح المعتمدة.
 */

export type VerifiedBadgeLevel = "gold" | "blue"
export type VerifiedEntityKind = "actor" | "troupe" | "venue"

export type VerifiedEntity = {
  id: string
  name: string
  kind: VerifiedEntityKind
  level: VerifiedBadgeLevel
  grantedAt: string
  note?: string
}

export const BADGES_STORAGE_KEY = "kawalees:verified-badges"
export const BADGES_CHANGE_EVENT = "kawalees:verified-badges-change"

export const BADGE_LEVEL_LABELS: Record<VerifiedBadgeLevel, string> = {
  gold: "توثيق ذهبي",
  blue: "توثيق أزرق",
}

export const BADGE_KIND_LABELS: Record<VerifiedEntityKind, string> = {
  actor: "ممثل",
  troupe: "فرقة",
  venue: "مسرح",
}

export const SEED_VERIFIED_ENTITIES: VerifiedEntity[] = [
  {
    id: "ver-troupe-1",
    name: "مسرح الحر المستقل",
    kind: "troupe",
    level: "gold",
    grantedAt: "2026-01-15T10:00:00.000Z",
    note: "فرقة معتمدة — سجل عروض منتظم منذ 2019",
  },
  {
    id: "ver-actor-1",
    name: "كريم عادل",
    kind: "actor",
    level: "blue",
    grantedAt: "2026-02-02T09:30:00.000Z",
    note: "ممثل متعاون مع ثلاث فرق معتمدة",
  },
  {
    id: "ver-venue-1",
    name: "مسرح الهوسابير",
    kind: "venue",
    level: "gold",
    grantedAt: "2026-01-20T14:00:00.000Z",
  },
]

/* ---------- المخزن ---------- */

function parseBadges(raw: string | null): VerifiedEntity[] {
  if (!raw) return SEED_VERIFIED_ENTITIES
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEED_VERIFIED_ENTITIES
    return (parsed as VerifiedEntity[]).filter((item) => item && typeof item.id === "string")
  } catch {
    return SEED_VERIFIED_ENTITIES
  }
}

let cachedRaw: string | null | undefined
let cachedBadges: VerifiedEntity[] = SEED_VERIFIED_ENTITIES

export function readVerifiedEntities(): VerifiedEntity[] {
  if (typeof window === "undefined") return SEED_VERIFIED_ENTITIES
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(BADGES_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedBadges = parseBadges(raw)
  }
  return cachedBadges
}

function persistBadges(entities: VerifiedEntity[]): void {
  if (typeof window === "undefined") return
  cachedBadges = entities
  const raw = JSON.stringify(entities)
  try {
    window.localStorage.setItem(BADGES_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل — نكمل بالذاكرة.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(BADGES_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(BADGES_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(BADGES_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): VerifiedEntity[] => SEED_VERIFIED_ENTITIES

/** الكيانات الموثقة الحيّة (ممثلون/فرق/مسارح). */
export function useVerifiedEntities(): VerifiedEntity[] {
  return useSyncExternalStore(subscribe, readVerifiedEntities, getServerSnapshot)
}


/* ---------- العمليات (منح/سحب التوثيق) ---------- */

/** منح شارة توثيق لكيان (يستبدل المستوى إن كان موثقًا سابقًا). */
export function grantBadge(input: {
  name: string
  kind: VerifiedEntityKind
  level: VerifiedBadgeLevel
  note?: string
}): VerifiedEntity | null {
  const name = input.name.trim()
  if (name.length < 2) return null
  const existing = readVerifiedEntities().find((entity) => entity.name.trim() === name && entity.kind === input.kind)
  const entity: VerifiedEntity = {
    id: existing?.id ?? `ver-${Math.random().toString(36).slice(2, 9)}`,
    name,
    kind: input.kind,
    level: input.level,
    grantedAt: new Date().toISOString(),
    note: input.note?.trim() || existing?.note,
  }
  persistBadges([entity, ...readVerifiedEntities().filter((item) => item.id !== entity.id)])
  return entity
}

/** تغيير مستوى التوثيق (ذهبي ↔ أزرق). */
export function setBadgeLevel(id: string, level: VerifiedBadgeLevel): void {
  persistBadges(
    readVerifiedEntities().map((entity) =>
      entity.id === id ? { ...entity, level, grantedAt: new Date().toISOString() } : entity,
    ),
  )
}

/** سحب التوثيق تمامًا. */
export function revokeBadge(id: string): void {
  persistBadges(readVerifiedEntities().filter((entity) => entity.id !== id))
}

/** هل هذا الكيان موثق؟ (يُستعمل لإظهار الشارة في اللوحات) */
export function isVerified(name: string, kind?: VerifiedEntityKind): boolean {
  return badgeFor(name, kind) !== null
}

/** شارة كيان بعينه (لعرض المستوى واللون). */
export function badgeFor(name: string, kind?: VerifiedEntityKind): VerifiedEntity | null {
  const target = name.trim()
  if (target.length === 0) return null
  return (
    readVerifiedEntities().find(
      (entity) => entity.name.trim() === target && (kind === undefined || entity.kind === kind),
    ) ?? null
  )
}

/** إحصاء التوثيق حسب النوع. */
export function badgeStats(entities: VerifiedEntity[] = readVerifiedEntities()) {
  return {
    total: entities.length,
    gold: entities.filter((entity) => entity.level === "gold").length,
    blue: entities.filter((entity) => entity.level === "blue").length,
    actors: entities.filter((entity) => entity.kind === "actor").length,
    troupes: entities.filter((entity) => entity.kind === "troupe").length,
  }
}
