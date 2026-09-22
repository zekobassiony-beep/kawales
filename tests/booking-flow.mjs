// Database-backed integration test for the booking funnel.
//
//   node tests/booking-flow.mjs
//
// It books real seats on a real on-sale performance through the very same
// server action the UI calls, verifies what landed in Postgres, proves the
// double-booking guard works, and then removes everything it created.
import assert from "node:assert/strict"
import { register } from "node:module"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { resolveConnectionString } from "./load-env.mjs"

register("./alias-loader.mjs", import.meta.url)

const { Client } = pg
const CUSTOMER = {
  customerName: "Automated Booking Test",
  customerEmail: "booking-test@kawalees.test",
  customerPhone: "+20000000000",
}

let failures = 0
let createdBookingId = null
let createdEventId = null

function pass(message) {
  console.log(`  PASS  ${message}`)
}

function fail(message) {
  failures += 1
  console.error(`  FAIL  ${message}`)
}

const connectionString = resolveConnectionString()
if (!connectionString) {
  console.error("No DATABASE_URL/POSTGRES_URL configured - the integration test needs a database.")
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
})
await client.connect()

// The app modules read DATABASE_URL at call time, so set it before importing.
process.env.DATABASE_URL = connectionString
const { createBooking } = await import("@/app/actions/booking")
const { calculateTotals } = await import("@/lib/pricing")
const { buildVenueSeatIds } = await import("@/lib/seats")

async function findBookableEvent() {
  const { rows } = await client.query(`
    SELECT e.id, e.slug, e.title, e.price_tiers, v.rows AS venue_rows, v.seats_per_row
      FROM events AS e
      JOIN venues AS v ON v.id = e.venue_id
     WHERE e.status = 'on_sale' AND e.starts_at > now()
     ORDER BY e.starts_at
     LIMIT 1`)
  return rows[0] ?? null
}

async function takenSeats(eventId) {
  const { rows } = await client.query("SELECT seat_id FROM booked_seats WHERE event_id = $1", [
    eventId,
  ])
  return new Set(rows.map((row) => row.seat_id))
}

/**
 * يُنشئ عرضًا ماضيًا مؤقتًا للتحقق من حارس نافذة البيع ثم يحذفه — لا يحتاج
 * إلى بيانات ماضية موجودة مسبقًا في القاعدة.
 */
async function withTemporaryPastEvent(run) {
  const slug = `kw-past-probe-${Date.now()}`
  const { rows } = await client.query(
    `INSERT INTO events (slug, title, tagline, description, category, language, duration_minutes,
                         troupe_id, venue_id, starts_at, price_tiers, featured, status)
     VALUES ($1, 'عرض اختباري ماضٍ', '', '', 'دراما', 'عربي', 60,
             (SELECT MIN(id) FROM troupes), (SELECT MIN(id) FROM venues),
             now() - interval '1 hour', $2, false, 'on_sale')
     RETURNING id`,
    [slug, JSON.stringify([{ id: "general", name: "عام", priceCents: 10000, color: "#c9a227", rows: [0, 1, 2, 3, 4, 5, 6, 7] }])],
  )
  const eventId = rows[0].id
  try {
    return await run(eventId, slug)
  } finally {
    await client.query("DELETE FROM events WHERE id = $1", [eventId])
  }
}

try {
  const event = await findBookableEvent()
  if (!event) throw new Error("no on-sale performance in the future was found in the database")
  console.log(`\nBooking round-trip on "${event.title}" (${event.slug})\n`)
  createdEventId = event.id

  const before = await takenSeats(event.id)
  const freeSeats = buildVenueSeatIds(event.venue_rows, event.seats_per_row).filter(
    (seatId) => !before.has(seatId),
  )
  assert.ok(freeSeats.length >= 2, "the performance needs at least two free seats")

  // Two free seats; the second one should land in a different price tier.
  const firstSeat = freeSeats[0]
  const tiers = Array.isArray(event.price_tiers) ? event.price_tiers : []
  const rowIndex = (seatId) => seatId.charCodeAt(0) - 65
  const tierFor = (seatId) =>
    tiers.find((candidate) => candidate.rows.includes(rowIndex(seatId))) ??
    tiers[tiers.length - 1]

  // Prefer a second seat in a different price tier so the per-seat pricing is
  // really probed; fall back to the next free seat otherwise.
  const firstTierId = tierFor(firstSeat)?.id
  const secondSeat =
    freeSeats.find((seatId) => tierFor(seatId)?.id !== firstTierId) ?? freeSeats[1]
  const priceFor = (seatId) => tierFor(seatId).priceCents
  const expected = calculateTotals([priceFor(firstSeat), priceFor(secondSeat)])

  // ---- 1. Happy path ----
  const result = await createBooking({
    eventId: event.id,
    seatIds: [firstSeat, secondSeat],
    ...CUSTOMER,
  })

  if (!result.ok) {
    fail(`createBooking returned an error: ${result.error}`)
  } else {
    pass(`createBooking reserved ${firstSeat} + ${secondSeat} (${result.reference})`)

    const { rows: bookingRows } = await client.query("SELECT * FROM bookings WHERE reference = $1", [
      result.reference,
    ])
    const booking = bookingRows[0]
    if (!booking) {
      fail("the booking row was not written to the database")
    } else {
      createdBookingId = booking.id
      assert.equal(booking.event_id, event.id)
      assert.equal(booking.customer_email, CUSTOMER.customerEmail)
      assert.equal(booking.status, "confirmed")
      assert.equal(booking.total_cents, expected.totalCents)
      assert.equal(booking.seats.length, 2)
      assert.equal(result.totalCents, expected.totalCents)
      pass(
        `booking row stored with total ${booking.total_cents} (incl. ${expected.serviceFeeCents} fee)`,
      )

      const { rows: seatRows } = await client.query(
        "SELECT seat_id FROM booked_seats WHERE booking_id = $1 ORDER BY seat_id",
        [booking.id],
      )
      assert.deepEqual(
        seatRows.map((row) => row.seat_id).sort(),
        [firstSeat, secondSeat].sort(),
      )
      pass("both seats were locked in booked_seats")

      // ---- 2. Double-booking guard ----
      const conflict = await createBooking({
        eventId: event.id,
        seatIds: [firstSeat],
        ...CUSTOMER,
        customerEmail: "someone-else@kawalees.test",
      })
      if (conflict.ok) {
        fail("a second booking on the same seat was allowed")
      } else if (!conflict.takenSeats?.includes(firstSeat)) {
        fail(`the conflict did not report ${firstSeat} as taken: ${JSON.stringify(conflict)}`)
      } else {
        pass("double-booking the same seat is rejected and the taken seat is reported")
      }

      // ---- 3. Seat outside the venue grid ----
      const ghost = await createBooking({ eventId: event.id, seatIds: ["Z99"], ...CUSTOMER })
      if (ghost.ok || !/غير موجود/.test(ghost.error)) {
        fail(`a seat outside the venue grid was not rejected: ${JSON.stringify(ghost)}`)
      } else {
        pass("a seat outside the venue grid is rejected")
      }
    }
  }

  // ---- 4. Sale-window guard against a temporarily created past performance ----
  // The Egyptian season intentionally has no past performances, so this check
  // creates one, proves the guard blocks it, and removes it right after.
  await withTemporaryPastEvent(async (pastEventId, pastSlug) => {
    const blocked = await createBooking({ eventId: pastEventId, seatIds: ["A1"], ...CUSTOMER })
    if (blocked.ok || !/بدأ هذا العرض/.test(blocked.error)) {
      fail(`booking a past performance was not blocked: ${JSON.stringify(blocked)}`)
    } else {
      pass(`booking the past performance "${pastSlug}" is blocked`)
    }
  })
} catch (error) {
  fail(`integration run crashed: ${error.message}`)
} finally {
  // ---- Cleanup: remove exactly what this run created ----
  try {
    if (createdBookingId !== null) {
      await client.query("DELETE FROM booked_seats WHERE booking_id = $1", [createdBookingId])
      const deleted = await client.query("DELETE FROM bookings WHERE id = $1", [createdBookingId])
      if (deleted.rowCount === 1) pass("cleanup removed the test booking and its seats")
      else fail("cleanup could not remove the test booking")

      if (createdEventId !== null) {
        const remaining = await client.query(
          "SELECT COUNT(*)::int AS count FROM booked_seats WHERE event_id = $1",
          [createdEventId],
        )
        if (remaining.rows[0].count === 0) pass("the performance is back to an empty seat map")
        else fail(`${remaining.rows[0].count} seat(s) were left behind by the test`)
      }
    }
  } catch (cleanupError) {
    fail(`cleanup failed: ${cleanupError.message}`)
  }

  await client.end().catch(() => {})
  // The app's pg pool keeps the event loop alive; close it explicitly.
  const { pool } = await import("@/lib/db")
  await pool.end().catch(() => {})
  await delay(50)
}

console.log(`\n${failures === 0 ? "INTEGRATION OK" : "INTEGRATION FAILED"} - ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)