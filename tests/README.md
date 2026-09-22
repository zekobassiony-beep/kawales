# Tests

No test framework dependency is required – everything runs on Node's built-in
runner (`node:test`) with native TypeScript type stripping.

```bash
npm run typecheck        # tsc --noEmit (the Next build skips type checking)
npm test                 # unit suite: tests/unit/*.test.ts
npm run test:e2e         # production build + real HTTP smoke test on the routes
npm run test:integration # real booking round-trip against the database
npm run test:db          # read-only database diagnostics
npm run test:all         # typecheck + unit + e2e + integration
npm run db:cleanup-seats # dry run; add --apply to delete orphaned booked seats
```

## Layout

| Path | Purpose |
| --- | --- |
| `tests/run-unit.mjs` | Discovers `tests/unit/**/*.test.ts` and drives `node --test` |
| `tests/register-hooks.mjs` | Registers the resolver below via `--import` |
| `tests/alias-loader.mjs` | Resolves `@/*` and extension-less relative imports for plain Node |
| `tests/load-env.mjs` | Reads `.env.local` the same way for every standalone script |
| `tests/unit/format.test.ts` | `lib/format.ts` – prices, dates, durations, row labels, tiers |
| `tests/unit/seats.test.ts` | `lib/seats.ts` – seat ids, venue bounds, tier colours |
| `tests/unit/pricing.test.ts` | `lib/pricing.ts` – 10% service fee with a 5 minimum |
| `tests/unit/booking-rules.test.ts` | `lib/booking-rules.ts` – on-sale / start-time guards |
| `tests/unit/queries.test.ts` | `lib/queries.ts` – mock fallback and 0-based tier coverage |
| `tests/unit/booking.test.ts` | `app/actions/booking.ts` – server-side input validation |
| `tests/smoke.mjs` | Boots `next start` and checks `/`, `/shows`, seat map, closed shows, 404s |
| `tests/booking-flow.mjs` | Books real seats, verifies Postgres, then deletes what it created |
| `tests/probe-db.mjs` | Connects with `DATABASE_URL`, reports counts, tiers and orphans |
| `scripts/cleanup-orphan-seats.mjs` | Removes `booked_seats` rows whose booking no longer exists |

The unit run deliberately has **no** `DATABASE_URL`, which is exactly the
condition that makes `withDbFallback` serve the bundled mock season.

`tests/booking-flow.mjs` is the only writing test: it uses a real on-sale
performance, fills in two free seats, asserts the stored total (seats + 10%
fee), proves the double-booking guard, and then removes the booking and its
seats again. Always run it with `npm run test:integration` so the alias
resolver and clean shutdown are handled for you.

