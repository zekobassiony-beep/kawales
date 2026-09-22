import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatDate,
  formatDuration,
  formatPrice,
  formatTime,
  rowLabel,
  tierForRow,
  type SeatTier,
} from "../../lib/format"

// Intl separates currency code and amount with a non-breaking space in some ICU
// builds; normalise it so assertions are stable across platforms.
const norm = (value: string) => value.replace(/\u00a0/g, " ")

describe("formatPrice", () => {
  it("formats piastres as whole Egyptian-pound amounts with the ج.م label", () => {
    assert.equal(norm(formatPrice(25000)), "250 ج.م")
    assert.equal(norm(formatPrice(15000)), "150 ج.م")
    assert.equal(norm(formatPrice(1500)), "15 ج.م")
    assert.equal(norm(formatPrice(0)), "0 ج.م")
  })

  it("never renders fractional digits", () => {
    assert.doesNotMatch(norm(formatPrice(999)), /\.\d/)
  })
})

describe("formatDate / formatTime", () => {
  const iso = "2026-10-12T19:00:00+03:00"

  it("accepts both Date objects and ISO strings", () => {
    assert.equal(formatDate(iso), formatDate(new Date(iso)))
    assert.equal(formatTime(iso), formatTime(new Date(iso)))
  })

  it("renders an Arabic weekday, month and year in Cairo time", () => {
    const formatted = formatDate(iso)
    assert.match(formatted, /[\u0621-\u064A]/) // Arabic letters
    assert.match(formatted, /أكتوبر/)
    assert.match(formatted, /2026/)
  })

  it("renders an hours:minutes time with the م/ص suffix", () => {
    assert.match(formatTime(iso), /\d{1,2}:\d{2}\s?[مص]/)
  })
})

describe("formatDuration", () => {
  it("formats minutes, whole hours and mixed durations in Arabic", () => {
    assert.equal(formatDuration(0), "0 دقيقة")
    assert.equal(formatDuration(45), "45 دقيقة")
    assert.equal(formatDuration(60), "ساعة")
    assert.equal(formatDuration(90), "ساعة و30 دقيقة")
    assert.equal(formatDuration(110), "ساعة و50 دقيقة")
    assert.equal(formatDuration(120), "ساعتان")
    assert.equal(formatDuration(135), "ساعتان و15 دقيقة")
  })
})

describe("rowLabel", () => {
  it("maps row indexes to letters", () => {
    assert.equal(rowLabel(0), "A")
    assert.equal(rowLabel(1), "B")
    assert.equal(rowLabel(25), "Z")
  })

  it("falls back to a 1-based R label beyond the alphabet", () => {
    assert.equal(rowLabel(26), "R27")
    assert.equal(rowLabel(99), "R100")
  })
})

describe("tierForRow", () => {
  const tiers: SeatTier[] = [
    { id: "orchestra", name: "Orchestra", priceCents: 25000, color: "#c9a227", rows: [1, 2, 3, 4] },
    { id: "balcony", name: "Balcony", priceCents: 15000, color: "#6b7280", rows: [5, 6, 7, 8] },
  ]

  it("picks the tier that owns the row", () => {
    assert.equal(tierForRow(tiers, 1).id, "orchestra")
    assert.equal(tierForRow(tiers, 4).id, "orchestra")
    assert.equal(tierForRow(tiers, 5).id, "balcony")
    assert.equal(tierForRow(tiers, 8).id, "balcony")
  })

  it("falls back to the last (cheapest) tier for overflow rows", () => {
    assert.equal(tierForRow(tiers, 99).id, "balcony")
  })

  it("returns undefined when there are no tiers at all", () => {
    // Callers must guard against a misconfigured event with no pricing.
    assert.equal(tierForRow([], 0), undefined)
  })
})
