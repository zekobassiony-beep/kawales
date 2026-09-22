// Removes `booked_seats` rows that point at a booking which no longer exists.
//
// The unique constraint on (event_id, seat_id) means an orphaned row keeps a
// seat permanently "taken", so these rows must be cleaned up.
//
// Usage:
//   node scripts/cleanup-orphan-seats.mjs            # dry run (default)
//   node scripts/cleanup-orphan-seats.mjs --apply    # delete the orphans
import pg from "pg"
import { resolveConnectionString } from "../tests/load-env.mjs"

const { Client } = pg
const apply = process.argv.includes("--apply")
const connectionString = resolveConnectionString()

if (!connectionString) {
  console.error("No DATABASE_URL/POSTGRES_URL configured — nothing to clean.")
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
})

const ORPHANS_QUERY = `
  SELECT bs.id, bs.event_id, bs.seat_id, bs.booking_id
    FROM booked_seats AS bs
   WHERE NOT EXISTS (SELECT 1 FROM bookings AS b WHERE b.id = bs.booking_id)
   ORDER BY bs.event_id, bs.seat_id`

const DELETE_QUERY = `
  DELETE FROM booked_seats AS bs
   WHERE NOT EXISTS (SELECT 1 FROM bookings AS b WHERE b.id = bs.booking_id)`

try {
  await client.connect()
  await client.query("BEGIN")

  const before = await client.query("SELECT COUNT(*)::int AS count FROM booked_seats")
  const orphans = await client.query(ORPHANS_QUERY)

  console.log(`booked_seats rows : ${before.rows[0].count}`)
  console.log(`orphaned rows     : ${orphans.rowCount}`)
  for (const row of orphans.rows.slice(0, 10)) {
    console.log(`  - seat ${row.seat_id} (event ${row.event_id}, booking_id ${row.booking_id})`)
  }
  if (orphans.rowCount > 10) {
    console.log(`  … and ${orphans.rowCount - 10} more`)
  }

  if (!apply) {
    await client.query("ROLLBACK")
    console.log("\nDry run only — re-run with --apply to delete these rows.")
  } else {
    const deleted = await client.query(DELETE_QUERY)
    await client.query("COMMIT")
    const after = await client.query("SELECT COUNT(*)::int AS count FROM booked_seats")
    console.log(`\nDeleted ${deleted.rowCount} orphaned row(s).`)
    console.log(`booked_seats rows : ${after.rows[0].count}`)
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {})
  console.error(`Cleanup failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}