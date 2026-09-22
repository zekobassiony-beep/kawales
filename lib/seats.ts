import { ROW_LABELS, rowLabel } from "@/lib/format"

/** Maximum number of seats a single order may hold. */
export const MAX_SEATS_PER_BOOKING = 8

export type SeatCoordinates = { rowIndex: number; seatNumber: number }

/**
 * Seat ids are `<ROW LETTER><SEAT NUMBER>` where the row letter is A-based on a
 * 0-based row index (`rowLabel(0)` is "A"), e.g. `A1`, `B12`.
 */
export function makeSeatId(rowIndex: number, seatNumber: number): string {
  return `${rowLabel(rowIndex)}${seatNumber}`
}

export function parseSeatId(seatId: string): SeatCoordinates | null {
  if (typeof seatId !== "string") return null
  const match = /^([A-Z])(\d{1,2})$/.exec(seatId.trim())
  if (!match) return null
  const rowIndex = ROW_LABELS.indexOf(match[1])
  if (rowIndex < 0) return null
  const seatNumber = Number.parseInt(match[2], 10)
  if (seatNumber < 1) return null
  return { rowIndex, seatNumber }
}

export function isSeatInVenue(seatId: string, rows: number, seatsPerRow: number): boolean {
  const parsed = parseSeatId(seatId)
  if (!parsed) return false
  return parsed.rowIndex < rows && parsed.seatNumber <= seatsPerRow
}

/** Every seat id that exists in a venue, row by row, left to right. */
export function buildVenueSeatIds(rows: number, seatsPerRow: number): string[] {
  const seatIds: string[] = []
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
      seatIds.push(makeSeatId(rowIndex, seatNumber))
    }
  }
  return seatIds
}

/** `#rrggbb` (or `#rgb`) to an `rgba()` string, used for tier-tinted seats. */
export function hexToRgba(hex: string, alpha: number): string {
  const fallback = `rgba(148, 163, 184, ${alpha})`
  if (typeof hex !== "string") return fallback
  const normalized = hex.trim().replace(/^#/, "")
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
