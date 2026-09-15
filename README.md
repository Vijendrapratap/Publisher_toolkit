# Publisher Toolkit

A platform of tools for book publishers: Ads Creative, Trailer Video, Audio Book, and Landing Page & Website.

## Run locally

```bash
npm install
npm run dev
```

No accounts or keys needed. The dev script starts a local Postgres, applies migrations and starts Next.js. See `.env.example` for how to switch a capability to its real service.

## Tests

```bash
npm run db:test &        # local Postgres for integration tests
npx dotenv -e .env.test -- npx vitest run
npm run test:e2e         # full local browser flow
```
