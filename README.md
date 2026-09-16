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

## Tests

```bash
npm run db:test &        # local Postgres for integration tests
npx dotenv -e .env.test -- npx vitest run
npm run test:e2e         # full local browser flow
```
