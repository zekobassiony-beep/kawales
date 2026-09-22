"use client"

import { useSyncExternalStore } from "react"
import { rowLabel } from "@/lib/format"

/**
 * مُنشئ تخطيط المسرح الهجين (Hybrid Venue Layout Builder) — الحالة والمساعدات.
 *
 * لا يوجد جدول تخطيط في قاعدة البيانات بعد (نفس أسلوب باقي اللوحات)، لذا يُخزَّن
 * المخطط في `localStorage` ويُقرأ عبر `useVenueLayout()` ليُحدَّث كل ما يعتمد
 * عليه (كروت الإحصائيات والمعاينة) فورًا عند التعديل.
 */

export type TemplateId = "flat_floor" | "classic_tiered" | "d_shape_grandstand"

export type VenueSector = {
  id: string
  name: string
  rows: number
  seatsPerRow: number
  /** مقاعد معطّلة (ممر/مكسور) بصيغة `A3` — منعًا لحجزها. */
  blockedSeats: string[]
}

export type VenueLayout = {
  templateId: TemplateId
  sectors: VenueSector[]
}

export const VENUE_LAYOUT_STORAGE_KEY = "kawalees:venue-layout"
export const VENUE_LAYOUT_CHANGE_EVENT = "kawalees:venue-layout-change"

export const TEMPLATES: { id: TemplateId; icon: string; name: string; description: string; sectors: { name: string; rows: number; seatsPerRow: number }[] }[] = [
  {
    id: "flat_floor",
    icon: "🏛️",
    name: "مسرح الصالة الواحدة (Flat Floor)",
    description: "قطاع واحد للجمهور مقابل المنصة — مناسب للعروض التجريبية والمونودراما.",
    sectors: [{ name: "الصالة الرئيسية", rows: 10, seatsPerRow: 14 }],
  },
  {
    id: "classic_tiered",
    icon: "🎭",
    name: "المسرح الكلاسيكي (Classic Tiered)",
    description: "صالة أمامية + بنوار + بلكون علوي — التقسيم التقليدي للمسارح المغلقة.",
    sectors: [
      { name: "الصالة الأمامية", rows: 8, seatsPerRow: 12 },
      { name: "البنوار", rows: 4, seatsPerRow: 10 },
      { name: "البلكون العلوي", rows: 6, seatsPerRow: 10 },
    ],
  },
  {
    id: "d_shape_grandstand",
    icon: "🎪",
    name: "مسرح المدرجات (D-Shape Grandstand)",
    description: "قطاع أوسط يحيط به قطاعان جانبيان بشكل (D) — أقصى استغلال للقاعة.",
    sectors: [
      { name: "القطاع الأوسط", rows: 8, seatsPerRow: 12 },
      { name: "القطاع الأيمن", rows: 5, seatsPerRow: 6 },
      { name: "القطاع الأيسر", rows: 5, seatsPerRow: 6 },
    ],
  },
]

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  flat_floor: "صالة واحدة",
  classic_tiered: "كلاسيكي متدرج",
  d_shape_grandstand: "مدرجات (D)",
}

export function makeSectorId(): string {
  return `sector-${Math.random().toString(36).slice(2, 8)}`
}

export function sectorsFromTemplate(templateId: TemplateId): VenueSector[] {
  const template = TEMPLATES.find((item) => item.id === templateId)
  if (!template) return []
  return template.sectors.map((sector) => ({
    id: makeSectorId(),
    name: sector.name,
    rows: sector.rows,
    seatsPerRow: sector.seatsPerRow,
    blockedSeats: [],
  }))
}

export function defaultVenueLayout(): VenueLayout {
  return { templateId: "classic_tiered", sectors: sectorsFromTemplate("classic_tiered") }
}

export function sectorCapacity(sector: VenueSector): number {
  return Math.max(sector.rows, 0) * Math.max(sector.seatsPerRow, 0)
}

/** إجمالي السعة المتاحة = كل المقاعد − المعطلة منها. */
export function layoutCapacity(layout: VenueLayout): number {
  const total = layout.sectors.reduce((sum, sector) => sum + sectorCapacity(sector), 0)
  const blocked = layout.sectors.reduce((sum, sector) => sum + sector.blockedSeats.length, 0)
  return Math.max(total - blocked, 0)
}

/** كل مقاعد القطاع بصيغة `A1`, `A2`, … حسب صفوفه. */
export function sectorSeatIds(sector: VenueSector): string[] {
  const seats: string[] = []
  for (let rowIndex = 0; rowIndex < sector.rows; rowIndex += 1) {
    for (let seatIndex = 1; seatIndex <= sector.seatsPerRow; seatIndex += 1) {
      seats.push(`${rowLabel(rowIndex)}${seatIndex}`)
    }
  }
  return seats
}


/* ---------- المخزن (localStorage + useSyncExternalStore) ---------- */

function parseLayout(raw: string | null): VenueLayout {
  if (!raw) return defaultVenueLayout()
  try {
    const parsed = JSON.parse(raw) as Partial<VenueLayout> | null
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sectors)) return defaultVenueLayout()
    return {
      templateId: parsed.templateId ?? "classic_tiered",
      sectors: parsed.sectors
        .filter((sector) => sector && typeof sector.id === "string")
        .map((sector) => ({
          id: sector.id,
          name: typeof sector.name === "string" ? sector.name : "قطاع",
          rows: Number.isInteger(sector.rows) ? sector.rows : 1,
          seatsPerRow: Number.isInteger(sector.seatsPerRow) ? sector.seatsPerRow : 1,
          blockedSeats: Array.isArray(sector.blockedSeats) ? sector.blockedSeats : [],
        })),
    }
  } catch {
    return defaultVenueLayout()
  }
}

let cachedRaw: string | null | undefined
let cachedLayout: VenueLayout = defaultVenueLayout()

/** يقرأ المخطط من التخزين المحلي (وعلى السيرفر يعيد القالب الافتراضي). */
export function readVenueLayout(): VenueLayout {
  if (typeof window === "undefined") return defaultVenueLayout()
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(VENUE_LAYOUT_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedLayout = parseLayout(raw)
  }
  return cachedLayout
}

function persistLayout(layout: VenueLayout): void {
  if (typeof window === "undefined") return
  cachedLayout = layout
  const raw = JSON.stringify(layout)
  try {
    window.localStorage.setItem(VENUE_LAYOUT_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل (تصفح خاص) — نكمل بالذاكرة فقط.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(VENUE_LAYOUT_CHANGE_EVENT))
}

function mutateLayout(updater: (current: VenueLayout) => VenueLayout): void {
  persistLayout(updater(readVenueLayout()))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(VENUE_LAYOUT_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(VENUE_LAYOUT_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = () => defaultVenueLayout()

/** مخطط المسرح الحالي — متزامن بين المُنشئ وكروت الإحصائيات والمعاينة. */
export function useVenueLayout(): VenueLayout {
  return useSyncExternalStore(subscribe, readVenueLayout, getServerSnapshot)
}

/* ---------- عمليات التعديل (المصفوفة التفاعلية) ---------- */

export function applyTemplate(templateId: TemplateId): void {
  mutateLayout(() => ({ templateId, sectors: sectorsFromTemplate(templateId) }))
}

export function addSector(name = "قطاع جديد"): void {
  mutateLayout((current) => ({
    ...current,
    sectors: [...current.sectors, { id: makeSectorId(), name, rows: 4, seatsPerRow: 8, blockedSeats: [] }],
  }))
}

export function removeSector(sectorId: string): void {
  mutateLayout((current) => ({ ...current, sectors: current.sectors.filter((sector) => sector.id !== sectorId) }))
}

export function renameSector(sectorId: string, name: string): void {
  mutateLayout((current) => ({
    ...current,
    sectors: current.sectors.map((sector) => (sector.id === sectorId ? { ...sector, name } : sector)),
  }))
}

export function setSectorSize(sectorId: string, patch: { rows?: number; seatsPerRow?: number }): void {
  mutateLayout((current) => ({
    ...current,
    sectors: current.sectors.map((sector) => {
      if (sector.id !== sectorId) return sector
      const rows = Math.min(26, Math.max(1, patch.rows ?? sector.rows))
      const seatsPerRow = Math.min(40, Math.max(1, patch.seatsPerRow ?? sector.seatsPerRow))
      // المقاعد المعطلة خارج الحدود الجديدة تُسقط تلقائيًا.
      const blockedSeats = sector.blockedSeats.filter((seatId) => {
        const match = /^([A-Z])(\d{1,2})$/.exec(seatId)
        if (!match) return false
        return (ROW_INDEX.get(match[1]) ?? 99) < rows && Number(match[2]) <= seatsPerRow
      })
      return { ...sector, rows, seatsPerRow, blockedSeats }
    }),
  }))
}

const ROW_INDEX = new Map("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => [letter, index]))

/** تبديل حالة كرسي بين متاح ومعطل (ممر/مكسور) داخل قطاع. */
export function toggleSeat(sectorId: string, seatId: string): void {
  mutateLayout((current) => ({
    ...current,
    sectors: current.sectors.map((sector) => {
      if (sector.id !== sectorId) return sector
      const isBlocked = sector.blockedSeats.includes(seatId)
      return {
        ...sector,
        blockedSeats: isBlocked
          ? sector.blockedSeats.filter((item) => item !== seatId)
          : [...sector.blockedSeats, seatId],
      }
    }),
  }))
}

/** حفظ المخطط وتأكيده (نفس المصدر — يُستدعى من زر «حفظ وتأكيد المخطط»). */
export function confirmVenueLayout(layout: VenueLayout): void {
  persistLayout(layout)
}
