import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SERVICE_FEE_MIN_CENTS,
  SERVICE_FEE_RATE,
  calculateServiceFee,
  calculateTotals,
} from "../../lib/pricing"

describe("service fee", () => {
  it("is 10% of the subtotal", () => {
    assert.equal(SERVICE_FEE_RATE, 0.1)
    assert.equal(calculateServiceFee(25000), 2500)
    assert.equal(calculateServiceFee(45000), 4500)
    assert.equal(calculateServiceFee(90000), 9000)
  })

  it("applies the 5 minimum on small orders", () => {
    assert.equal(SERVICE_FEE_MIN_CENTS, 500)
    assert.equal(calculateServiceFee(1000), 500)
    assert.equal(calculateServiceFee(2000), 500)
    // exactly at the boundary: 10% of 5000 is the minimum itself
    assert.equal(calculateServiceFee(5000), 500)
    assert.equal(calculateServiceFee(5001), 500)
    assert.equal(calculateServiceFee(6000), 600)
  })

  it("rounds to whole cents and stays an integer", () => {
    assert.equal(calculateServiceFee(25123), 2512)
    assert.equal(calculateServiceFee(25554), 2555)
    assert.ok(Number.isInteger(calculateServiceFee(13333)))
  })

  it("returns 0 when there is nothing to charge for", () => {
    assert.equal(calculateServiceFee(0), 0)
    assert.equal(calculateServiceFee(-100), 0)
    assert.equal(calculateServiceFee(Number.NaN), 0)
  })
})

describe("calculateTotals", () => {
  it("adds the service fee on top of the seat prices", () => {
    assert.deepEqual(calculateTotals([45000, 45000]), {
      subtotalCents: 90000,
      serviceFeeCents: 9000,
      totalCents: 99000,
    })
  })

  it("charges the minimum fee for a single cheap seat", () => {
    assert.deepEqual(calculateTotals([1200]), {
      subtotalCents: 1200,
      serviceFeeCents: 500,
      totalCents: 1700,
    })
  })

  it("handles an empty selection", () => {
    assert.deepEqual(calculateTotals([]), {
      subtotalCents: 0,
      serviceFeeCents: 0,
      totalCents: 0,
    })
  })

  it("matches the Egyptian example: 100 EGP base ticket -> 110 EGP total", () => {
    // «سجن الأميرة العاشقة»: سعر أساسي 100 ج.م ⬅️ رسمة max(10%, 5 ج.م) = 10 ج.م ⬅️ الإجمالي 110 ج.م
    const totals = calculateTotals([10000])
    assert.equal(totals.subtotalCents, 10000)
    assert.equal(totals.serviceFeeCents, 1000)
    assert.equal(totals.totalCents, 11000)
  })
})
