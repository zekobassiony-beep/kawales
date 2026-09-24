// End-to-end route smoke test.
//
// Starts the production server (`next start`) against the existing `.next`
// build and walks the real booking funnel: home -> catalog -> show detail.
// Usage: npm run test:e2e   (which builds first, then runs this file)
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { resolveConnectionString } from "./load-env.mjs"

const root = path.resolve(import.meta.dirname, "..")
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const port = Number(process.env.SMOKE_PORT || 4319)
const baseUrl = `http://127.0.0.1:${port}`
const READY_TIMEOUT_MS = 90_000

let failures = 0
const warnings = []

function pass(message) {
  console.log(`  PASS  ${message}`)
}

function fail(message) {
  failures += 1
  console.error(`  FAIL  ${message}`)
}

function warn(message) {
  warnings.push(message)
  console.warn(`  WARN  ${message}`)
}

async function get(pathname) {
  const response = await fetch(baseUrl + pathname, { redirect: "manual" })
  const body = await response.text()
  return { status: response.status, body }
}

/** Intl renders currency amounts with a non-breaking space; normalise it. */
const readable = (body) => body.replace(/\u00a0/g, " ")

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + "/", { redirect: "manual" })
      if (response.status < 500) return
    } catch {
      // server not listening yet
    }
    await delay(500)
  }
  throw new Error(`server did not become ready within ${READY_TIMEOUT_MS}ms`)
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" })
  } else {
    child.kill("SIGTERM")
  }
  await delay(500)
}

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
})

let serverLog = ""
server.stdout.on("data", (chunk) => (serverLog += chunk.toString()))
server.stderr.on("data", (chunk) => (serverLog += chunk.toString()))

try {
  await waitForServer()
  console.log(`\nNext.js is serving ${baseUrl}\n`)

  // 1. Home page
  const home = await get("/")
  if (home.status !== 200) fail(`GET / returned ${home.status}`)
  else if (!home.body.includes("كواليس")) fail("GET / did not contain the brand name")
  else pass("GET / renders the landing page")

  // 2. Catalog + slug discovery
  const catalog = await get("/shows")
  let slugs = []
  if (catalog.status !== 200) {
    fail(`GET /shows returned ${catalog.status}`)
  } else if (!catalog.body.includes("كل العروض")) {
    fail("GET /shows did not contain the catalog heading")
  } else {
    pass("GET /shows renders the catalog")
    slugs = [...new Set([...catalog.body.matchAll(/href="\/shows\/([a-z0-9-]+)"/g)].map((m) => m[1]))]
    if (slugs.length === 0) {
      fail(
        "GET /shows listed no shows - the database is reachable but empty, and the mock fallback only applies when it is down",
      )
    } else {
      pass(`GET /shows lists ${slugs.length} show(s)`)
    }
  }

  // 3. Walk every show detail page: find one bookable and one already closed
  let bookableSlug = null
  let closedSlug = null
  for (const slug of slugs) {
    const detail = await get(`/shows/${slug}`)
    if (detail.status !== 200) {
      fail(`GET /shows/${slug} returned ${detail.status}`)
      continue
    }
    const body = readable(detail.body)
    if (body.includes("احجز دلوقتي") || body.includes("متابعة إلى الدفع")) bookableSlug ??= slug
    else closedSlug ??= slug
  }

  if (bookableSlug) pass(`GET /shows/${bookableSlug} renders a detail page with a booking CTA`)
  else fail("no show on sale was found in the catalog")

  if (closedSlug) {
    const closed = await get(`/shows/${closedSlug}`)
    const closedBody = readable(closed.body)
    if (closed.status === 200 && !closedBody.includes("احجز دلوقتي") && !closedBody.includes("متابعة إلى الدفع")) {
      pass(`GET /shows/${closedSlug} hides the booking CTA while booking is closed`)
    } else {
      fail(`GET /shows/${closedSlug} still shows a booking CTA while booking is closed`)
    }
  }

  // 4. The retired multi-step paths redirect to the unified show detail page
  if (bookableSlug) {
    for (const retired of ["seats", "book"]) {
      const response = await get(`/shows/${bookableSlug}/${retired}`)
      if (response.status >= 300 && response.status < 400) {
        pass(`GET /shows/${bookableSlug}/${retired} redirects to the unified booking page`)
      } else {
        fail(`GET /shows/${bookableSlug}/${retired} did not redirect (returned ${response.status})`)
      }
    }
  }

  // 5. Ticket page rejects an unknown reference
  const unknownTicket = await get("/bookings/KW-NOPE00")
  if (unknownTicket.status !== 404) {
    fail(`GET /bookings/KW-NOPE00 returned ${unknownTicket.status}`)
  } else {
    pass("unknown booking reference returns 404")
  }

  // 6. The confirmation/ticket page renders a real booking
  const connectionString = resolveConnectionString()
  if (!connectionString) {
    warn("no DATABASE_URL configured - skipping the ticket page check")
  } else {
    const client = new pg.Client({
      connectionString,
      ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    })
    let bookingId = null
    const reference = `KW-SM${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    try {
      await client.connect()
      const { rows: eventRows } = await client.query(
        "SELECT id FROM events WHERE status = 'on_sale' AND starts_at > now() ORDER BY starts_at LIMIT 1",
      )
      if (eventRows.length === 0) {
        warn("no on-sale performance in the future - skipping the ticket page check")
      } else {
        // 52000 قرش (520 ج.م) + رسمة خدمة 10% = 57200 قرش (572 ج.م)
        const inserted = await client.query(
          `INSERT INTO bookings (reference, event_id, customer_name, customer_email, customer_phone, seats, total_cents, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed') RETURNING id`,
          [
            reference,
            eventRows[0].id,
            "Smoke Test",
            "smoke-test@kawalees.test",
            "",
            JSON.stringify([{ seatId: "A1", tierId: "vip", priceCents: 52000 }]),
            57200,
          ],
        )
        bookingId = inserted.rows[0].id

        const ticket = await get(`/bookings/${reference}`)
        const text = readable(ticket.body)
        if (ticket.status !== 200) {
          fail(`GET /bookings/${reference} returned ${ticket.status}`)
        } else if (!text.includes("تم تأكيد الحجز") || !text.includes(reference)) {
          fail(`/bookings/${reference} did not render the confirmation details`)
        } else if (!text.includes("572 ج.م")) {
          fail(`/bookings/${reference} did not render the charged total (572 ج.م)`)
        } else if (!text.includes("A1")) {
          fail(`/bookings/${reference} did not list the booked seats`)
        } else {
          pass(`GET /bookings/${reference} renders the digital ticket with its total`)
        }
      }
    } catch (error) {
      fail(`ticket page check crashed: ${error.message}`)
    } finally {
      if (bookingId !== null) {
        await client
          .query("DELETE FROM booked_seats WHERE booking_id = $1", [bookingId])
          .catch(() => {})
        const deleted = await client
          .query("DELETE FROM bookings WHERE id = $1", [bookingId])
          .catch(() => ({ rowCount: 0 }))
        if (deleted.rowCount === 1) pass("ticket page check cleaned up after itself")
      }
      await client.end().catch(() => {})
    }
  }

  // 7. Unknown slug must 404 rather than crash
  const missing = await get("/shows/definitely-not-a-real-show")
  if (missing.status !== 404) fail(`GET /shows/definitely-not-a-real-show returned ${missing.status}`)
  else pass("unknown show slug returns 404")

  // 8. Static assets referenced by the app
  for (const asset of ["/placeholder.svg", "/icon.svg"]) {
    const response = await fetch(baseUrl + asset)
    if (response.status === 200) pass(`GET ${asset} is served`)
    else fail(`GET ${asset} returned ${response.status}`)
  }
} catch (error) {
  fail(`smoke run crashed: ${error.message}`)
  if (serverLog.trim()) console.error(`\n--- server output ---\n${serverLog}`)
} finally {
  await stopServer(server)
}

console.log(
  `\n${failures === 0 ? "SMOKE OK" : "SMOKE FAILED"} - ${failures} failure(s), ${warnings.length} warning(s)`,
)
process.exit(failures === 0 ? 0 : 1)