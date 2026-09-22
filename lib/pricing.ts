/**
 * Booking pricing rules.
 *
 * A service fee is charged on top of the ticket subtotal: 10% of the subtotal
 * with a floor of 5 currency units (`SERVICE_FEE_MIN_CENTS`, expressed in cents
 * so it matches `lib/format.ts:formatPrice`).
 */
export const SERVICE_FEE_RATE = 0.1
export const SERVICE_FEE_MIN_CENTS = 500

export type BookingTotals = {
  subtotalCents: number
  serviceFeeCents: number
  totalCents: number
}

export function calculateServiceFee(subtotalCents: number): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0
  return Math.max(SERVICE_FEE_MIN_CENTS, Math.round(subtotalCents * SERVICE_FEE_RATE))
}

export function calculateTotals(seatPrices: number[]): BookingTotals {
  const subtotalCents = seatPrices.reduce((sum, price) => sum + (Number.isFinite(price) ? price : 0), 0)
  const serviceFeeCents = calculateServiceFee(subtotalCents)
  return { subtotalCents, serviceFeeCents, totalCents: subtotalCents + serviceFeeCents }
}
