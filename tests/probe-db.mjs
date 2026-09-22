// Read-only database diagnostics.
// Usage: node tests/probe-db.mjs
//
// Connects with the same precedence as `lib/db/index.ts` (DATABASE_URL then
// POSTGRES_URL) and reports which tables exist plus their row counts.
import pg from "pg"
import { resolveConnectionString } from "./load-env.mjs"

const { Client } = pg

const connectionString = resolveConnectionString()

if (!connectionString) {
  console.log("RESULT: no DATABASE_URL/POSTGRES_URL configured -> app will use mock data")
  process.exit(0)
}

if (!connectionString) {
  console.log("RESULT: no DATABASE_URL/POSTGRES_URL configured -> app will use mock data")
  process.exit(0)
}

const safeTarget = (() => {
  try {
    const url = new URL(connectionString)
    return `${url.hostname}${url.pathname}`
  } catch {
    return "(unparseable connection string)"
  }
})()

const client = new Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
})

try {
  await client.connect()
  console.log(`RESULT: connected to ${safeTarget}`)

  const tables = ["troupes", "venues", "events", "bookings", "booked_seats"]
  for (const table of tables) {
    try {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`)
      console.log(`  ${table.padEnd(13)} ${rows[0].count} row(s)`)
    } catch (error) {
      console.log(`  ${table.padEnd(13)} MISSING (${error.message})`)
    }
  }

  // Row-index convention check: `format.ts:rowLabel(0)` is "A" and
  // `booking.ts:rowIndexFromSeatId("A1")` is 0, so the tiers' `rows` values
  // decide whether the first row is priced at all.
  console.log("\n  events (status / start / tiers as stored):")
  const { rows: eventRows } = await client.query(
    `SELECT e.id, e.slug, e.title, e.status, e.starts_at, e.price_tiers,
            v.name AS venue_name, v.city AS venue_city, t.name AS troupe_name
       FROM events AS e
       JOIN venues AS v ON v.id = e.venue_id
       JOIN troupes AS t ON t.id = e.troupe_id
      ORDER BY e.starts_at`,
  )
  for (const event of eventRows) {
    const tiers = Array.isArray(event.price_tiers) ? event.price_tiers : []
    const summary = tiers
      .map((tier) => `${tier.name}[rows=${JSON.stringify(tier.rows)}]=${tier.priceCents}`)
      .join("  ")
    console.log(
      `    event ${event.id}: "${event.title}" (${event.slug}) ${event.status} ${event.starts_at.toISOString()}`,
    )
    console.log(
      `      ${event.troupe_name} @ ${event.venue_name}, ${event.venue_city} :: ${summary || "(no tiers)"}`,
    )
  }

  console.log("\n  orphan check (booked seats without a booking row):")
  const { rows: orphanRows } = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM booked_seats AS bs
       LEFT JOIN bookings AS b ON b.id = bs.booking_id
      WHERE b.id IS NULL`,
  )
  console.log(`    ${orphanRows[0].count} orphaned booked seat row(s)`)

  console.log("\n  sample booked seat ids:")
  const { rows: seatRows } = await client.query(
    "SELECT DISTINCT seat_id FROM booked_seats ORDER BY seat_id LIMIT 8",
  )
  console.log(`    ${seatRows.map((row) => row.seat_id).join(", ") || "(none)"}`)
  const { rows: venueRows } = await client.query(
    "SELECT id, slug, name, city, rows, seats_per_row FROM venues ORDER BY id",
  )
  for (const venue of venueRows) {
    console.log(
      `    venue ${venue.id}: ${venue.name} (${venue.slug}) — ${venue.city} — rows=${venue.rows} seatsPerRow=${venue.seats_per_row}`,
    )
  }

  console.log("\n  troupes:")
  const { rows: troupeRows } = await client.query(
    "SELECT id, slug, name, city, founded_year FROM troupes ORDER BY id",
  )
  for (const troupe of troupeRows) {
    console.log(
      `    troupe ${troupe.id}: ${troupe.name} (${troupe.slug}) — ${troupe.city} — est. ${troupe.founded_year}`,
    )
  }
} catch (error) {
  console.log(`RESULT: connection failed -> ${error.message}`)
  console.log("The app falls back to mock data when the database is unreachable.")
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}