# Publisher Toolkit

A platform of tools for book publishers: Ads Creative, Trailer Video, Audio Book, and Landing Page & Website.

## Run locally

```bash
npm install
npm run dev
```

No accounts or keys needed. The dev script picks a database, applies migrations and starts Next.js. See `.env.example` for how to switch a capability to its real service.

### Database modes

`npm run dev` picks one automatically, in this order, and prints which:

1. `DATABASE_URL` set → uses it as-is.
2. `supabase start` already running → uses the local Supabase stack (Postgres on 54322, Studio on http://127.0.0.1:54323).
3. Otherwise → zero-setup embedded Postgres, no install required.

## Accounts & credits

Local mode (no Clerk keys) skips accounts entirely: every request acts as a
single fixed publisher (`dev-local-publisher`), created on its first request
with a welcome grant. To run with real accounts:

1. Create a Clerk app and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `CLERK_SECRET_KEY` (see `.env.example`).
2. In the Clerk dashboard, turn on **email verification** and **bot
   protection** for the sign-up flow.
3. Add a webhook endpoint pointing at `/api/webhooks/clerk`, subscribed to
   the `user.created` event, and set its signing secret as
   `CLERK_WEBHOOK_SIGNING_SECRET`. This is how a new publisher's row and
   welcome credit grant get created outside local mode (signed-in page/API
   requests also create it lazily, so the webhook is a backstop, not the
   only path).

Every publisher gets a credit balance (`User.balance`), backed by an
append-only ledger (`CreditLedger`). Paid actions reserve credits up front
and settle or refund after the run; prices are defined once in
`lib/credits/prices.ts` (`CREDIT_PRICES`) — see that file for current
numbers, not duplicated here. `PLATFORM_DAILY_CREDIT_LIMIT` (default 5000)
caps total credits spent across all publishers per day.

Ops scripts (run with `DATABASE_URL` pointed at the target database):

```bash
# Manually grant (or deduct) credits, e.g. for support cases
node scripts/grant-credits.mjs <userId> <credits> [reason]

# Per-action margin report (runs, credits charged, cost, margin) for the last N days
node scripts/credit-report.mjs [days=30]
```

## Tests

```bash
npm run db:test &        # local Postgres for integration tests
npx dotenv -e .env.test -- npx vitest run
npm run test:e2e         # full local browser flow
```
