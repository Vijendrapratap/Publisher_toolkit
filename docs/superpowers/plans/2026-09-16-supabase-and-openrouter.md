# Local Supabase + OpenRouter Integration

**Goal:** Swap the dev database to a local Supabase stack, and make OpenRouter the real AI provider for ad copy, so the platform can be tested against real infrastructure and a real model.

**Spec:** `docs/superpowers/specs/2026-09-15-publisher-platform-design.md` — specifically its capability-switching rule, which both halves of this work must preserve.

## Global constraints (do not break these)

- **The platform must still run with no credentials and no `.env.local`.** `npm run dev` alone must work for someone with neither Docker nor an API key. Both integrations are *upgrades that activate when available*, never requirements.
- **The test suite must not depend on Docker.** `npm test` currently uses embedded-postgres on port 5432 (database `ads_creative_test`) via `.env.test`. Leave that alone. Supabase is for dev only.
- A capability switches to its real implementation only when its credential/service is present; no code change to switch.
- Ad copy failure after one retry still yields blank, editable copy rows — never a failed generation.
- Existing behaviour, tests and accessibility attributes stay intact. 106 tests currently pass.

## Environment facts (verified, don't re-derive)

- Supabase CLI v2.102.0 is installed at `~/.local/bin/supabase`. No `supabase/` directory exists in the project yet.
- Docker is **not** reachable right now (`docker version` → "could not be found in this WSL 2 distro"). The user is enabling Docker Desktop's WSL integration. Write the code so it works when Docker is up, and verify everything you can without it.
- `ai@7.0.101`, `zod@^4.6.5` are installed. `@openrouter/ai-sdk-provider@3.0.0` declares peers `ai: ^7.0.0`, `zod: ^3.25.76 || ^4.1.8` — compatible.
- No `OPENROUTER_API_KEY` is set. The user will add it to `.env.local` themselves.

---

## Part 1: OpenRouter as the AI provider

Currently `lib/services/ads/copy.ts` calls `generateText({ model: 'anthropic/claude-sonnet-5', … })`, which resolves through the Vercel AI Gateway, and `lib/providers/ai.ts` reports configured when `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is set. Replace that path with OpenRouter.

- Install `@openrouter/ai-sdk-provider@3.0.0`.
- `lib/providers/ai.ts`: `isAiConfigured()` becomes true when `OPENROUTER_API_KEY` is set. Export a small `getAdCopyModel()` that builds the OpenRouter provider and returns the model. Keep the module free of side effects at import time — construct the client lazily inside the function, so importing it without a key can't throw.
- Model id: default to Claude Sonnet, read from `OPENROUTER_MODEL` so it can be swapped without a code change. **Verify the exact current id** against `https://openrouter.ai/api/v1/models` (that endpoint needs no auth). If the network is unavailable, use `anthropic/claude-sonnet-4.5`, and say plainly in your report that you could not verify it.
- `lib/services/ads/copy.ts`: use `getAdCopyModel()` instead of the bare gateway string. Everything else about the function stays: the tone in the prompt, the platform filter, retry-once, and `[]` on repeated failure. The local-mode `sampleAdCopy` path is unchanged.
- Update `lib/providers/status.ts` so its `ai` capability reflects OpenRouter.
- `.env.example`: replace the AI Gateway lines with `OPENROUTER_API_KEY=` and `OPENROUTER_MODEL=`, keeping the "everything is optional" framing.
- Update the tests that stub the AI path. `lib/services/ads/copy.test.ts` sets `AI_GATEWAY_API_KEY` in `beforeEach` — that becomes `OPENROUTER_API_KEY`. `lib/providers/status.test.ts` references the old keys too. Keep every assertion's intent; only the key name changes.
- Add one test proving `getAdCopyModel()` reads `OPENROUTER_MODEL` when set and falls back to the default when not.

## Part 2: Local Supabase for dev

- Run `supabase init` to create `supabase/config.toml`. Commit it. Set the project id to something meaningful like `publisher-toolkit`.
- Local Supabase serves Postgres on **54322** (API 54321, Studio 54323). The dev connection string is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- `scripts/dev.mjs` currently starts embedded-postgres when `DATABASE_URL` is unset. New order of preference, all automatic:
  1. `DATABASE_URL` set → use it, touch nothing.
  2. Otherwise, if local Supabase is reachable (port 54322 open) → use the Supabase URL.
  3. Otherwise → the existing embedded-postgres path, unchanged.
  Print one clear line saying which one it picked, so it's obvious what you're connected to. Then `prisma migrate deploy` runs against whichever was chosen, exactly as now.
- Don't make dev.mjs *start* Supabase — starting Docker containers is the user's call. If Supabase isn't running, fall through to embedded-postgres silently rather than failing.
- `.gitignore`: add whatever `supabase init` generates that shouldn't be committed (it typically writes `supabase/.temp/`). Commit `config.toml` itself.
- `README.md`: document the three database modes in a few lines — `supabase start` for the full local stack with Studio, nothing at all for zero-setup embedded Postgres, or your own `DATABASE_URL`.

## Verification

1. `npx tsc --noEmit` clean.
2. `npm test` — all 106 existing tests plus your new ones, green, **with no Docker running**. This is the important one: it proves the test path is still Docker-free.
3. `npm run build` clean.
4. `npm run dev` with no `DATABASE_URL` and no Supabase running → must still work via embedded-postgres, print which database it chose, apply migrations, and serve the hub. Stop it cleanly afterwards.
5. Prove the OpenRouter wiring without a key: with `OPENROUTER_API_KEY` unset, generation must still produce a creative set using sample copy. Exercise it, don't assume.
6. If Docker becomes available while you're working, run `supabase start`, re-run `npm run dev`, confirm it picks Supabase and migrations apply. If Docker is still unavailable, say so explicitly rather than implying you tested it.

## Safety

- A shared Postgres runs on port 5432 and the user's own `next dev` on 3001. Never `pkill` anything; stop only processes you started, by PID.
- Never print, log or commit an API key. If `OPENROUTER_API_KEY` happens to be set in the environment, don't echo its value.
- Revert `next-env.d.ts` if it regenerates and isn't part of your change.
