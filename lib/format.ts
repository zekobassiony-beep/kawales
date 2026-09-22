/**
 * Egyptian Arabic formatting helpers.
 *
 * Amounts are stored in piastres (1/100 EGP) and always rendered in Egyptian
 * pounds. Dates are rendered in `Africa/Cairo` wall-clock time with Latin
 * digits (the convention Egyptian ticketing sites use) so tickets always show
 * the venue's local time no matter where the server runs.
 */
export const CURRENCY_CODE = "EGP"
export const CURRENCY_LABEL = "ج.م"
export const THEATRE_TIME_ZONE = "Africa/Cairo"

const LOCALE = "ar-EG-u-nu-latn-ca-gregory"

const NUMBER_FORMATTER = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
})

const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: THEATRE_TIME_ZONE,
})

const TIME_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: THEATRE_TIME_ZONE,
})

/** Strips the bidi control characters Intl leaves around Arabic output. */
function clean(value: string): string {
  return value.replace(/[\u200e\u200f\u061c]/g, "").replace(/\u00a0/g, " ").trim()
}

export function formatPrice(piastres: number): string {
  return `${NUMBER_FORMATTER.format(Math.round(piastres) / 100)} ${CURRENCY_LABEL}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return clean(DATE_FORMATTER.format(d))
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return clean(TIME_FORMATTER.format(d))
}

function hourLabel(hours: number): string {
  if (hours === 1) return "ساعة"
  if (hours === 2) return "ساعتان"
  if (hours >= 3 && hours <= 10) return `${hours} ساعات`
  return `${hours} ساعة`
}

function minuteLabel(minutes: number): string {
  if (minutes === 1) return "دقيقة"
  if (minutes === 2) return "دقيقتان"
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`
  return `${minutes} دقيقة`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return minuteLabel(m)
  if (m === 0) return hourLabel(h)
  return `${hourLabel(h)} و${minuteLabel(m)}`
}

export const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function rowLabel(index: number): string {
  return ROW_LABELS[index] ?? `R${index + 1}`
}

export type SeatTier = {
  id: string
  name: string
  priceCents: number
  color: string
  rows: number[]
}

export function tierForRow(
  tiers: SeatTier[],
  rowIndex: number,
): SeatTier {
  const match = tiers.find((t) => t.rows.includes(rowIndex))
  if (match) return match
  // fall back to the last (cheapest) tier for any overflow rows
  return tiers[tiers.length - 1]
}
