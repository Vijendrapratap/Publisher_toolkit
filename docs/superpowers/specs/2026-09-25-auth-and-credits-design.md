# Auth & Credits — Design

Sub-project 1+2 of the monetisation effort. Order of the full effort:
1+2 auth & credits (this) → 3 payments (Stripe credit packs) → 4 projects +
simplified ads UX → 5 scraper upgrade → 6 AI prompt/model quality.
5 and 6 are independent and may run in parallel with 3–4.

## Goal

Real user accounts, a credit balance per user, 20 free credits on signup, and
every paid AI action priced in credits so the business earns margin on model
spend. Close the auth holes found in review.

## Decisions (agreed)

- **Pricing model:** fixed credit price per action, shown before the click;
  real USD cost logged per generation for margin tracking. Not metered
  pass-through, not subscriptions (ledger supports adding them later).
- **1 credit ≈ $0.10.** Packs (sub-project 3) around $10 = 100 credits.
- **BYOK removed.** All generation runs on the platform OpenRouter key.
- **No data migration.** Existing rows are dev data and stay on the dev publisher.
- Signup grant: **20 credits**, exactly once per user.

## Data model

```prisma
model User {
  id        String   @id            // Clerk user id; equals existing publisherId values
  email     String
  balance   Int      @default(0)    // cache of SUM(CreditLedger.delta); DB CHECK (balance >= 0)
  createdAt DateTime @default(now())
  ledger    CreditLedger[]
}

model CreditLedger {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  delta          Int                  // + grant/purchase/refund, − reserve
  kind           String               // signup_grant | purchase | reserve | refund | adjust
  action         String?              // price-table key, e.g. "ads.image"
  refId          String?              // project/job id the charge belongs to
  costUsd        Float?               // real provider cost, filled after success
  settled        Boolean  @default(false) // reserve rows: true once succeeded or refunded
  idempotencyKey String   @unique
  createdAt      DateTime @default(now())

  @@index([userId, createdAt])
  @@index([kind, settled, createdAt])
}
```

`CHECK (balance >= 0)` is added in the migration's raw SQL (Prisma cannot
express it). Ledger rows are never updated except `costUsd`/`settled` on a
reserve row.

## Credit flow

One module, `lib/credits/` (`ledger.ts`, `prices.ts`), one entry point:

```ts
chargeCredits({ userId, action, units?, refId, idempotencyKey }, fn: () => Promise<{ result, costUsd? }>)
```

1. **Reserve** — single transaction: insert `reserve` row (delta = −price×units)
   and `UPDATE "User" SET balance = balance - n`. The CHECK constraint makes
   concurrent overspend impossible; a violation maps to `InsufficientCreditsError`
   → HTTP **402** `{ error, balance, required }`. A duplicate `idempotencyKey`
   returns the existing reservation's outcome instead of charging again.
2. **Run** `fn()`.
3. **Success** — mark reserve `settled`, store `costUsd`.
4. **Failure** — insert `refund` row (key `refund:<reserveKey>`, so refunds are
   idempotent), restore balance, mark settled, rethrow.

Long-running AI video: reserve at submit for all shots; the job's existing
`failed` path refunds unbilled shots (key `refund:<jobId>:<shotIndex>`).

**Stale reservations:** any `reserve` row unsettled after 30 min is refunded by
`sweepStaleReservations()`, called opportunistically (throttled to once per
minute per instance) from `chargeCredits`. No cron.

**Signup grant:** `ensureUser(userId, email)` upserts the `User` and inserts
the grant with key `signup:<userId>` — the unique key makes it exactly-once
whether triggered by the Clerk `user.created` webhook or first-request
lazy creation (whichever arrives first).

## Price table (`lib/credits/prices.ts`)

Checked against OpenRouter live pricing on 2026-09-25. Target ≥ 2× markup on
model cost; render-only actions priced to cover compute.

| Key | Route | Credits | Model cost |
|---|---|---|---|
| `ads.copy` | `ads/projects/[id]/generate` (copy output) | 1 / platform | < $0.01 (deepseek-v4.1-flash) |
| `ads.image` | same, image-ads output | 3 | ~$0.04 (gemini-2.5-flash-image) + render |
| `ads.aplus` | same, A+ output | 4 | ~$0.05–0.08 |
| `ads.video.instant` | `ads/projects/[id]/video/instant` | 2 | compute only |
| `ads.video.ai` | `ads/projects/[id]/video/ai` | 10 / 5s shot | $0.42 (kling-v3.0-std @ $0.084/s) |
| `trailer.render` | `trailer/projects/[id]/generate` | 2 / aspect ratio | compute only |
| `landing.agent` | `landing/projects/[id]/agent` | 2 | < $0.01 |
| `audiobook.tts` | `audiobook/projects/[id]/generate` | 1 / 10 min audio | TTS provider |
| `creator.generate` | `creator/projects` (generation), `[id]/chapter` | 3 | < $0.02 |
| `creator.illustrate` | `creator/projects/[id]/illustrate` | 3 / image | ~$0.04 |
| `extract.url` | `extract-url` | 0 (rate-limited) | fetch only |

Until sub-project 4 splits ad generation per output type, `ads/generate`
charges the sum of the outputs it produces.

Prices live only in this table; the UI reads them from it (exported for
client use) so the displayed and charged price cannot drift.

## Removals

- BYOK: `app/api/settings/ai-key`, its settings UI, and the `credentials`
  plumbing in `lib/providers/ai.ts` callers (platform key only).
- `AI_VIDEO_DAILY_LIMIT_USD` per-publisher cap → replaced by credits plus one
  **global** daily platform spend cap `PLATFORM_DAILY_LIMIT_USD` (sum of
  `costUsd` today); tripping it returns 503 "Generation paused, try later".

## Auth hardening

- Delete the cookie auth flow: `app/api/auth/{login,logout,session}` and
  `components/auth/LoginForm.tsx`; `AccountChip` switches to Clerk's
  `UserButton`/`useUser`. Anyone can currently POST any `publisherId` and impersonate that
  publisher when Clerk keys are absent.
- Dev fallback (`DEV_PUBLISHER_ID`) allowed only when `NODE_ENV !== 'production'`;
  in production, missing Clerk keys throw at boot.
- `requireCurrentPublisherId()` calls `ensureUser()` (cached per request) so a
  signed-in user always has a `User` row.
- Clerk webhook `app/api/webhooks/clerk/route.ts`: verify signature via
  Clerk's `verifyWebhook`, handle `user.created` → `ensureUser`. Public route
  in `proxy.ts`.
- Replace deprecated `createRouteMatcher` in `proxy.ts` per current Clerk docs.
- Signup abuse: rely on Clerk email verification + bot protection (dashboard
  config, documented in README). Revisit if farming appears in the credit report.

## Security audit scope

- Ownership: every `[id]` route returns 404 for another user's resource —
  one test per resource type.
- `extract-url`: re-verify SSRF guard (private IPs, redirects, DNS rebinding),
  add per-user rate limit.
- Uploads: enforce size and MIME limits at every upload route.
- `npm audit` — fix high/critical.
- Findings beyond this scope go to `docs/FOLLOWUPS.md`.

(`/api/files/[...path]` already enforces publisher ownership — verified, no change.)

## UI

- Balance chip in the platform header (reads `/api/credits/balance`).
- Every Generate button shows its price ("Generate · 3 credits").
- 402 → "Not enough credits" dialog with a Buy credits link (stub page until
  sub-project 3).

## Ops

`scripts/credit-report.mjs` — per action for a date range: count, credits
charged, sum `costUsd`, margin. Used to tune the price table.

## Testing

Vitest on embedded Postgres:
- balance equals ledger sum after mixed operations
- two concurrent charges exceeding balance → exactly one succeeds, other 402
- failing `fn` refunds; repeated failure refunds once
- duplicate idempotency key charges once
- signup grant exactly once across webhook + lazy paths
- stale-reservation sweep refunds only unsettled rows older than 30 min
- AI video: failed shots refunded, billed shots kept
- ownership 404 per resource; login route gone; prod boot without Clerk keys fails

Playwright (Clerk test mode): sign up → balance 20 → generate image ads →
balance 17.

## Refinements from planning (override the sections above)

- **Ads generation charges the price of the book's content goal** (the price
  the picker showed): A+ 4, Image Ads 3, Video 2; legacy `all` projects 9.
  Copy is included. A video-goal run whose video fails is refunded.
- **Reservation keys are server-generated** (`reserve:<uuid>`, `video:<jobId>`);
  no client `Idempotency-Key` header. Double-submits are prevented by the
  existing disabled-while-pending buttons and the one-active-AI-video index.
  Settle/refund stay idempotent per key.
- **Fallback output is free:** a route whose AI call returned
  `source: 'fallback'` settles with `usedUnits: 0` (full refund).
- **AI video:** reserved per started 5-second block per shot; a failed job is
  refunded in full (the user got nothing usable); settled on completion. The
  stale sweep skips AI video, whose jobs are closed by the status poll.
- **Global cap is in credits, not USD:** `PLATFORM_DAILY_CREDIT_LIMIT`
  (default 5000) over the last 24h of net reservations. `costUsd` is recorded
  where the provider reports it (AI video today); the credit report shows
  "cost unknown" counts for the rest.
- **402 UX:** the error message ("This needs N credits and you have M.") plus a
  link to a `/credits` page (balance + history, "buying coming soon") instead of
  a modal.
- **Proxy:** `clerkMiddleware()` with no path matching; auth is enforced by
  `auth.protect()` inside `requireCurrentPublisherId()` and in the platform
  layout. The prod no-keys guard lives in `instrumentation.ts`.
- **Security finding:** the URL importer followed redirects without re-checking
  the target, so a public URL could redirect to cloud metadata. Fixed by
  following redirects manually and checking every hop.
- **Ops:** `scripts/grant-credits.mjs` for support adjustments.

## Out of scope

Payments/checkout (3), per-output ads UX (4), scraper (5), prompt/model work (6),
admin dashboard, subscriptions.
