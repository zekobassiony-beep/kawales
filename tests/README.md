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
npm run db:diagnose-tickets # why a ticket fails to save in Supabase (env + columns + real write)
npm run telegram:bridge  # forward real Telegram button clicks to localhost (dev)
npm run telegram:info    # getWebhookInfo: registered URL + last_error_message
```

## Telegram admin buttons (قبول/رفض) on localhost

Telegram only delivers `callback_query` updates to a **public HTTPS URL**, so a
localhost server never receives the clicks. Three supported ways to test them:

1. **Local bridge (no tunnel needed)** — in two terminals:

   ```bash
   npm run dev
   npm run telegram:bridge    # deleteWebhook + getUpdates + POST to localhost:3000
   ```

   Every click on `✅ قبول` / `❌ رفض` is forwarded to
   `http://localhost:3000/api/telegram/webhook`. Stop with `Ctrl+C`; pass
   `--restore=https://<your-domain>/api/telegram/webhook` to re-register the
   production webhook automatically when the bridge exits. Prefer a separate
   development bot token so the production bot keeps working.

2. **Public tunnel** — `cloudflared tunnel --url http://localhost:3000`
   (or `ngrok http 3000`), then register it:

   ```bash
   node tests/telegram-webhook.mjs https://<public-host>/api/telegram/webhook
   node tests/telegram-webhook.mjs --secret=<TELEGRAM_WEBHOOK_SECRET>
   ```

   Re-register after every tunnel restart.

3. **Synthetic callback (no Telegram at all)** — validates the decision logic,
   the database update and the published ticket image:

   ```bash
   curl -X POST http://localhost:3000/api/telegram/webhook \
     -H "Content-Type: application/json" \
     -d '{"callback_query":{"id":"1","data":"approve_KW-ABC123","message":{"chat":{"id":123},"message_id":5}}}'
   ```

   The Telegram API calls fail with the fake callback id (expected); check the
   decision with `GET /api/tickets/status?id=KW-ABC123` (status + `imageUrl`) or
   `GET /api/tickets/statuses?ids=KW-ABC123`.

Diagnostics: `GET /api/telegram/webhook` → `{ configured, secretProtected }`, and
`GET /api/telegram/webhook?check=1` → `getWebhookInfo` (url, pending updates,
`last_error_message`) without exposing the bot token.

Optional hardening: set `TELEGRAM_WEBHOOK_SECRET` and register it with
`--secret=…`; the webhook then rejects any request whose
`X-Telegram-Bot-Api-Secret-Token` header does not match.


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
| `scripts/diagnose-tickets.mjs` | Ticket-save diagnostics: env vars, real `tickets` columns, anon vs service_role write, and a full app-path upsert |

The unit run deliberately has **no** `DATABASE_URL`, which is exactly the
condition that makes `withDbFallback` serve the bundled mock season.

`tests/booking-flow.mjs` is the only writing test: it uses a real on-sale
performance, fills in two free seats, asserts the stored total (seats + 10%
fee), proves the double-booking guard, and then removes the booking and its
seats again. Always run it with `npm run test:integration` so the alias
resolver and clean shutdown are handled for you.

## E2E auth (توثيق آلي للاختبارات الشاملة)

الدخول في المنصة **مصادقة Supabase حقيقية**، ونافذة الدخول على `/login` لا تصبح
قابلة للتفاعل قبل النقر على بطاقة فئة — لذلك يفشل أي مشغّل آلي عند خطوة «الدخول»
وتفشل معه كل التدفقات. يوجد الآن مسار توثيق مخصّص للاختبار يفتح جلسة حقيقية:

```bash
npm run e2e:auth                                   # السرّ + روابط الدخول الجاهزة
node scripts/e2e-auth-info.mjs --check=http://127.0.0.1:3000
```

| الطلب | النتيجة |
| --- | --- |
| `GET /api/e2e/auth?token=…&role=troupe&next=/dashboard/producer` | يفتح جلسة (كوكيز Supabase) ثم 303 إلى `next` أو لوحة الفئة |
| `POST /api/e2e/auth` بجسم `{ "token", "role", "next" }` | نفس النتيجة + JSON فيه `redirect` (بلا تحويل) |
| `GET /api/e2e/auth?token=…&action=logout` | ينهي الجلسة ويحوّل إلى `/login` |

- **الحساب:** `admin@kawalees.test` — يُنشأ تلقائيًا بمفتاح الخدمة ببريد مؤكَّد عند
  أول استخدام (كلمة مروره `kawalees-e2e-2026` افتراضيًا؛ بدّلها بـ
  `KAWALEES_E2E_AUTH_PASSWORD` أو `?password=`).
- **تجاوز بوابة الأدمن:** البريد التجريبي يمرّ من `/producer` و`/gatekeeper`
  و`/dashboard/admin` و`/hq-kawalees` في الاختبار فقط، بلا أي تعديل على جدول
  `admin_users`.
- **دخول عبر الواجهة:** `/login?role=troupe&auth=1` يفتح نافذة الدخول مباشرة، وحقولها
  تحمل `data-testid` ثابتة: `role-card-<role>` · `auth-modal` ·
  `auth-tab-signin|auth-tab-signup` · `auth-email` · `auth-password` ·
  `auth-confirm` · `auth-submit`.

### التفعيل

في `.env.local` (محلي فقط، غير محفوظ في المستودع):

```bash
KAWALEES_E2E_AUTH="1"
KAWALEES_E2E_AUTH_TOKEN="…"                        # مطلوب في كل طلب
KAWALEES_E2E_AUTH_EMAILS="admin@kawalees.test,e2e@kawalees.test"
```

- الوضع **معطّل افتراضيًا** ويشترط العلامة + السرّ معًا، ويُخفي المسار تمامًا (404)
  عند التعطيل.
- **ممنوع في الإنتاج:** يُقفل تلقائيًا عند `VERCEL_ENV=production` إلا بتجاوز صريح
  `KAWALEES_E2E_AUTH_ALLOW_PRODUCTION=1`.
- بعد تغيير العلامة أعد التفعيل (`next build`/`npm run dev`) لأن الوسيط يقرأ قيمة
  وقت البناء (انظر التعليق في `lib/e2e-auth.ts`).

`npm run test:e2e` (بناء + `tests/smoke.mjs`) يتحقق فعليًا عبر HTTP من: رفض الطلب بلا
سرّ (401)، فتح جلسة حقيقية، مرور المسار المحمي بالجلسة بدل التحويل إلى `/login`،
وإنهاء الجلسة.


