import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getBookingByReference,
  getBookedSeatIds,
  getCategories,
  getEventBySlug,
  getEvents,
  getFeaturedEvents,
  getTroupes,
} from "../../lib/queries"

// The whole test run intentionally has no database configured: `withDbFallback`
// must degrade to the bundled mock season instead of throwing.
const CLEARED = { DATABASE_URL: "", POSTGRES_URL: "" }

function withoutDatabase() {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
  }
  Object.assign(process.env, CLEARED)
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe("queries without a database (mock fallback)", () => {
  it("getEvents returns the mock season sorted by date", async () => {
    const restore = withoutDatabase()
    try {
      const events = await getEvents()
      assert.ok(events.length >= 2, "expected at least two mock events")

      const slugs = events.map((event) => event.slug)
      assert.ok(slugs.includes("night-at-the-qahwa"))
      assert.ok(slugs.includes("the-last-tram"))

      for (const event of events) {
        assert.equal(typeof event.title, "string")
        assert.ok(event.startsAt instanceof Date)
        assert.ok(!Number.isNaN(event.startsAt.getTime()))
        assert.ok(event.troupe.name.length > 0)
        assert.ok(event.venue.rows > 0)
        assert.ok(event.venue.seatsPerRow > 0)
        assert.ok(event.priceTiers.length > 0)
        for (const tier of event.priceTiers) {
          assert.ok(tier.id.length > 0)
          assert.ok(tier.priceCents > 0)
          assert.ok(Array.isArray(tier.rows) && tier.rows.length > 0)
        }
      }

      const times = events.map((event) => event.startsAt.getTime())
      assert.deepEqual(times, [...times].sort((a, b) => a - b))
    } finally {
      restore()
    }
  })

  it("getFeaturedEvents only returns featured events", async () => {
    const restore = withoutDatabase()
    try {
      const featured = await getFeaturedEvents()
      assert.ok(featured.length > 0)
      assert.ok(featured.every((event) => event.featured))
    } finally {
      restore()
    }
  })

  it("getEventBySlug resolves a known slug and returns null otherwise", async () => {
    const restore = withoutDatabase()
    try {
      const event = await getEventBySlug("night-at-the-qahwa")
      assert.equal(event?.title, "ليلة في القهوة")

      assert.equal(await getEventBySlug("does-not-exist"), null)
    } finally {
      restore()
    }
  })

  it("getTroupes and getCategories expose the mock data", async () => {
    const restore = withoutDatabase()
    try {
      const troupes = await getTroupes()
      assert.ok(troupes.length >= 2)
      assert.ok(troupes.every((troupe) => troupe.name.length > 0))

      const categories = await getCategories()
      assert.deepEqual(categories, ["دراما", "كوميديا"])
    } finally {
      restore()
    }
  })

  it("seat and booking lookups degrade to empty results", async () => {
    const restore = withoutDatabase()
    try {
      assert.deepEqual(await getBookedSeatIds(1), [])
      assert.equal(await getBookingByReference("KW-ABCDEF"), null)
    } finally {
      restore()
    }
  })

  it("prices every seat row with 0-based tier indexes", async () => {
    const restore = withoutDatabase()
    try {
      const events = await getEvents()
      for (const event of events) {
        // `format.ts:rowLabel(0)` is "A" and the booking action reads "A1" as row 0,
        // so the tiers must cover rows 0..venue.rows-1 exactly once.
        const covered = event.priceTiers.flatMap((tier) => tier.rows).sort((a, b) => a - b)
        assert.deepEqual(
          covered,
          Array.from({ length: event.venue.rows }, (_, index) => index),
          `${event.slug} tiers do not cover rows 0..${event.venue.rows - 1}`,
        )
      }
    } finally {
      restore()
    }
  })

  it("falls back to mock data when the database is unreachable", async () => {
    const restore = withoutDatabase()
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    // Port 1 refuses immediately, so this exercises the catch branch quickly.
    process.env.POSTGRES_URL = "postgresql://user:secret@127.0.0.1:1/nonexistent"
    try {
      const events = await getEvents()
      assert.ok(events.length >= 2, "expected the mock season after a failed query")
      assert.ok(
        warnings.some((line) => line.includes("Database unavailable")),
        "expected a warning describing the database failure",
      )
    } finally {
      console.warn = originalWarn
      restore()
    }
  })
})
