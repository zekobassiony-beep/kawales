import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_SEATS_PER_BOOKING,
  buildVenueSeatIds,
  hexToRgba,
  isSeatInVenue,
  makeSeatId,
  parseSeatId,
} from "../../lib/seats"

describe("seat ids", () => {
  it("builds ids from a 0-based row index", () => {
    assert.equal(makeSeatId(0, 1), "A1")
    assert.equal(makeSeatId(1, 12), "B12")
    assert.equal(makeSeatId(25, 9), "Z9")
  })

  it("round-trips through parseSeatId", () => {
    for (const [rowIndex, seatNumber] of [
      [0, 1],
      [1, 12],
      [9, 14],
      [25, 7],
    ] as const) {
      const seatId = makeSeatId(rowIndex, seatNumber)
      assert.deepEqual(parseSeatId(seatId), { rowIndex, seatNumber }, seatId)
    }
  })

  it("rejects malformed ids", () => {
    for (const seatId of ["", "1A", "A0", "A100", "AA1", "a1", "A-1", "A 1", "R271"]) {
      assert.equal(parseSeatId(seatId), null, `expected ${JSON.stringify(seatId)} to be invalid`)
    }
  })

  it("tolerates surrounding whitespace", () => {
    assert.deepEqual(parseSeatId(" B7 "), { rowIndex: 1, seatNumber: 7 })
  })

  it("cannot round-trip rows beyond the alphabet", () => {
    // rowLabel(26) is "R27" so the id would be ambiguous ("R271"); venues that
    // deep are not supported by the id format.
    assert.equal(parseSeatId(makeSeatId(26, 1)), null)
  })
})

describe("isSeatInVenue", () => {
  it("accepts seats inside the venue grid", () => {
    assert.equal(isSeatInVenue("A1", 10, 14), true)
    assert.equal(isSeatInVenue("A14", 10, 14), true)
    assert.equal(isSeatInVenue("J14", 10, 14), true)
  })

  it("rejects seats outside the venue grid", () => {
    assert.equal(isSeatInVenue("A15", 10, 14), false)
    assert.equal(isSeatInVenue("K1", 10, 14), false)
    assert.equal(isSeatInVenue("A1", 0, 14), false)
    assert.equal(isSeatInVenue("nope", 10, 14), false)
  })
})

describe("buildVenueSeatIds", () => {
  it("lists every seat row by row", () => {
    assert.deepEqual(buildVenueSeatIds(2, 3), ["A1", "A2", "A3", "B1", "B2", "B3"])
    assert.equal(buildVenueSeatIds(10, 14).length, 140)
  })

  it("matches the real venue dimensions used in the app", () => {
    // venues: 10x14, 8x12, 6x10, 12x16
    for (const [rows, seatsPerRow] of [
      [10, 14],
      [8, 12],
      [6, 10],
      [12, 16],
    ] as const) {
      const seatIds = buildVenueSeatIds(rows, seatsPerRow)
      assert.equal(seatIds.length, rows * seatsPerRow)
      assert.ok(seatIds.every((seatId) => isSeatInVenue(seatId, rows, seatsPerRow)))
    }
  })
})

describe("hexToRgba", () => {
  it("converts 6-digit and 3-digit hex colours", () => {
    assert.equal(hexToRgba("#c9a227", 0.5), "rgba(201, 162, 39, 0.5)")
    assert.equal(hexToRgba("6b7280", 0.16), "rgba(107, 114, 128, 0.16)")
    assert.equal(hexToRgba("#fff", 1), "rgba(255, 255, 255, 1)")
  })

  it("falls back to a neutral grey for invalid colours", () => {
    assert.equal(hexToRgba("gold", 0.3), "rgba(148, 163, 184, 0.3)")
    assert.equal(hexToRgba("", 0.3), "rgba(148, 163, 184, 0.3)")
  })
})

describe("MAX_SEATS_PER_BOOKING", () => {
  it("caps an order at 8 seats", () => {
    assert.equal(MAX_SEATS_PER_BOOKING, 8)
  })
})
