# Auth & Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Clerk accounts with a credit balance (20 free on signup), every paid AI action charged in credits, BYOK removed, and the auth/SSRF holes closed.

**Architecture:** An append-only `CreditLedger` plus a cached `User.balance` guarded by a conditional update and a DB `CHECK`. One module (`lib/credits/`) owns prices, reservations and settlement; each paid route wraps its work in `chargeCredits()`, which reserves up front and refunds on failure or fallback output. Auth moves from middleware path-matching to per-resource `auth.protect()` inside `requireCurrentPublisherId()`, which also lazily creates the `User`.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + PostgreSQL, Clerk (`@clerk/nextjs` 7), Vitest (embedded Postgres), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-auth-and-credits-design.md` (read its "Refinements from planning" section — it overrides earlier lines).

## Global Constraints

- 1 credit ≈ $0.10. Signup grant: **20 credits**, exactly once per user (`idempotencyKey = signup:<userId>`).
- Prices live only in `lib/credits/prices.ts`; UI and charging both read `CREDIT_PRICES`.
- `User.id` is the Clerk user id and equals every existing `publisherId` column value. Do not add FKs from existing tables to `User`.
- No BYOK: all AI calls use `process.env.OPENROUTER_API_KEY`.
- Dev fallback publisher `dev-local-publisher` only when `NODE_ENV !== 'production'`.
- Git identity: `git config user.name "Vijendrapratap"` / `git config user.email "44225657+Vijendrapratap@users.noreply.github.com"`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Before any Next.js API use, check `node_modules/next/dist/docs/` (AGENTS.md: this Next version has breaking changes).
- DB tests run against the test DB: start it with `node scripts/test-db.mjs` (foreground, separate terminal), then `npx prisma migrate deploy` with `.env.test` loaded (`npx dotenv -e .env.test -- prisma migrate deploy`). Tests run with `npm test -- <path>`.
- DB test files share one database across parallel workers: each file uses its own id prefix and deletes only its own rows.

## Review Focus

1. **Two tabs spend the last credits at once** → exactly one succeeds, the other gets 402; balance never negative. (Task 2 test `concurrent reservations`.)
2. **AI returns sample/fallback content** (no key, timeout, bad JSON) → the user is not charged. (Task 3 test `refunds when usedUnits is 0`; Task 6/8 route tests assert `usedUnits: 0` on `source: 'fallback'`.)
3. **A settle and a refund race on the same reservation** (poll + sweep) → only the first applies; balance moves once. (Task 2 test `settle after refund is a no-op`.)
4. **Imported URL redirects to an internal address** (`169.254.169.254`) → refused before the second request is made. (Task 10 test `refuses a redirect to a private address`.)
5. **Signed-out request to any API route** → no data and no 500 (401/404); `/p/:slug` and `/api/webhooks/clerk` still reachable signed-out. (Task 4 tests + manual curl in Task 4 Step 9.)

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20260925120000_users_and_credits/` | `User`, `CreditLedger`, CHECK constraint |
| `lib/credits/prices.ts` (exists) | price table, `CreditAction`, goal → action mapping, labels |
| `lib/credits/ledger.ts` | `ensureUser`, `reserveCredits`, `settleReservation`, `refundReservation`, `getBalance`, `sweepStaleReservations`, errors |
| `lib/credits/charge.ts` | `chargeCredits()` wrapper, `creditErrorResponse()` |
| `lib/providers/auth.ts` | `requireCurrentPublisherId()` via `auth.protect()` + `ensureUser` |
| `instrumentation.ts` | refuse to boot in production without Clerk keys |
| `app/api/webhooks/clerk/route.ts` | `user.created` → `ensureUser` |
| `app/api/credits/balance/route.ts` | balance for the header chip |
| `app/(platform)/credits/page.tsx` | balance + recent ledger + "buying coming soon" |
| `components/platform/CreditBalance.tsx` | header chip |
| `lib/rateLimit.ts` | per-instance fixed-window limiter |
| `lib/services/extract/urlExtractor.ts` | manual redirect following with per-hop public-address check |
| `scripts/credit-report.mjs`, `scripts/grant-credits.mjs` | ops |

---

### Task 1: Schema — `User` and `CreditLedger`

**Files:**
- Modify: `prisma/schema.prisma` (append models)
- Create: `prisma/migrations/20260925120000_users_and_credits/migration.sql`
- Test: `lib/credits/schema.test.ts`

**Interfaces:**
- Produces: Prisma models `prisma.user` (`id`, `email`, `balance`, `createdAt`) and `prisma.creditLedger` (`id`, `userId`, `delta`, `kind`, `action`, `refId`, `costUsd`, `settled`, `idempotencyKey`, `createdAt`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/credits/schema.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'

const PREFIX = 'schematest_'

describe('credits schema', () => {
  afterEach(async () => {
    await prisma.creditLedger.deleteMany({ where: { userId: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } })
  })

  it('rejects a negative balance at the database', async () => {
    await prisma.user.create({ data: { id: `${PREFIX}u1`, email: 'a@b.c', balance: 1 } })
    await expect(
      prisma.user.update({ where: { id: `${PREFIX}u1` }, data: { balance: { decrement: 2 } } })
    ).rejects.toThrow(/check constraint|23514/i)
  })

  it('rejects a duplicate idempotency key', async () => {
    await prisma.user.create({ data: { id: `${PREFIX}u2`, email: 'a@b.c' } })
    const row = { userId: `${PREFIX}u2`, delta: 1, kind: 'adjust', idempotencyKey: `${PREFIX}k1` }
    await prisma.creditLedger.create({ data: row })
    await expect(prisma.creditLedger.create({ data: row })).rejects.toMatchObject({ code: 'P2002' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/credits/schema.test.ts`
Expected: FAIL — `prisma.user` is undefined / type error.

- [ ] **Step 3: Add the models** (append to `prisma/schema.prisma`)

```prisma
/// Clerk user id. Existing tables keep their plain `publisherId` string
/// columns — they hold this same id, but no FK is added to them.
/// `balance` is a cache of SUM(CreditLedger.delta); CHECK (balance >= 0)
/// lives in migration 20260925120000_users_and_credits (Prisma can't express it).
model User {
  id        String         @id
  email     String
  balance   Int            @default(0)
  createdAt DateTime       @default(now())
  ledger    CreditLedger[]
}

/// Append-only. Only `settled`/`costUsd` on a `reserve` row are ever updated.
model CreditLedger {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  delta          Int
  kind           String   // signup_grant | purchase | reserve | refund | adjust
  action         String?
  refId          String?
  costUsd        Float?
  settled        Boolean  @default(false)
  idempotencyKey String   @unique
  createdAt      DateTime @default(now())

  @@index([userId, createdAt])
  @@index([kind, settled, createdAt])
}
```

- [ ] **Step 4: Generate the migration and add the CHECK**

Run: `npx dotenv -e .env.test -- prisma migrate dev --name users_and_credits --create-only`
Rename the created folder to `prisma/migrations/20260925120000_users_and_credits/` and append to its `migration.sql`:

```sql
ALTER TABLE "User" ADD CONSTRAINT "User_balance_non_negative" CHECK ("balance" >= 0);
```

Then: `npx dotenv -e .env.test -- prisma migrate deploy && npx prisma generate`

- [ ] **Step 5: Run the test**

Run: `npm test -- lib/credits/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add prisma lib/credits/schema.test.ts
git commit -m "feat(credits): User and CreditLedger tables with non-negative balance check"
```

---

### Task 2: Ledger core

**Files:**
- Modify: `lib/credits/prices.ts`
- Modify: `lib/credits/prices.test.ts`
- Create: `lib/credits/ledger.ts`
- Test: `lib/credits/ledger.test.ts`

**Interfaces:**
- Consumes: Task 1 models.
- Produces:
  - `CREDIT_PRICES`, `type CreditAction = keyof typeof CREDIT_PRICES`, `adsGenerationAction(goal: string | null): CreditAction`, `goalCreditLabel(goal: AdGoal): string`, `aiVideoUnits(durationsSec: number[]): number`
  - `SIGNUP_CREDITS = 20`
  - `ensureUser(id: string, getEmail: () => Promise<string>): Promise<User>`
  - `interface Reservation { key: string; userId: string; action: CreditAction; units: number; credits: number }`
  - `reserveCredits(input: { userId: string; action: CreditAction; units?: number; refId?: string; key?: string }): Promise<Reservation>`
  - `settleReservation(key: string, opts?: { usedUnits?: number; costUsd?: number }): Promise<void>`
  - `refundReservation(key: string): Promise<void>`
  - `getBalance(userId: string): Promise<number>`
  - `sweepStaleReservations(opts?: { force?: boolean; now?: number }): Promise<number>`
  - `class InsufficientCreditsError { required: number; balance: number }`, `class PlatformLimitError`

- [ ] **Step 1: Extend the price table test**

Replace `lib/credits/prices.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { CREDIT_PRICES, adsGenerationAction, aiVideoUnits, goalCreditLabel } from './prices'

describe('credit prices', () => {
  it('labels each ad goal with its table price', () => {
    expect(goalCreditLabel('aplus')).toBe(`${CREDIT_PRICES['ads.aplus']} credits`)
    expect(goalCreditLabel('sponsored')).toBe(`${CREDIT_PRICES['ads.image']} credits`)
    expect(goalCreditLabel('video')).toBe(`from ${CREDIT_PRICES['ads.video.instant']} credits`)
  })

  it('maps a stored content goal to the action that is charged', () => {
    expect(adsGenerationAction('aplus')).toBe('ads.aplus')
    expect(adsGenerationAction('sponsored')).toBe('ads.image')
    expect(adsGenerationAction('video')).toBe('ads.video.instant')
    expect(adsGenerationAction('all')).toBe('ads.bundle')
    expect(adsGenerationAction(null)).toBe('ads.bundle')
  })

  it('counts AI video units as 5-second blocks, at least one per shot', () => {
    expect(aiVideoUnits([5, 5])).toBe(2)
    expect(aiVideoUnits([10])).toBe(2)
    expect(aiVideoUnits([3])).toBe(1)
  })
})
```

- [ ] **Step 2: Write the ledger test**

```ts
// lib/credits/ledger.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  InsufficientCreditsError,
  SIGNUP_CREDITS,
  ensureUser,
  getBalance,
  refundReservation,
  reserveCredits,
  settleReservation,
  sweepStaleReservations,
} from './ledger'
import { CREDIT_PRICES } from './prices'

const PREFIX = 'ledgertest_'
let n = 0
const newUser = async (balance?: number) => {
  const id = `${PREFIX}${Date.now()}_${n++}`
  await ensureUser(id, async () => 'reader@example.com')
  if (balance !== undefined) await prisma.user.update({ where: { id }, data: { balance } })
  return id
}
const ledgerSum = async (userId: string) =>
  (await prisma.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } }))._sum.delta ?? 0

afterEach(async () => {
  await prisma.creditLedger.deleteMany({ where: { userId: { startsWith: PREFIX } } })
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } })
})

describe('ensureUser', () => {
  it('grants the signup credits exactly once', async () => {
    const id = await newUser()
    await ensureUser(id, async () => 'reader@example.com')
    await Promise.all([ensureUser(id, async () => 'x'), ensureUser(id, async () => 'x')])
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS)
    expect(await prisma.creditLedger.count({ where: { userId: id, kind: 'signup_grant' } })).toBe(1)
  })

  it('survives two first-requests racing to create the same user', async () => {
    const id = `${PREFIX}race_${Date.now()}`
    await Promise.all([ensureUser(id, async () => 'a@b.c'), ensureUser(id, async () => 'a@b.c')])
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS)
  })
})

describe('reserve / settle / refund', () => {
  it('reserves the table price times units and keeps balance equal to the ledger sum', async () => {
    const id = await newUser()
    const r = await reserveCredits({ userId: id, action: 'ads.image', units: 2 })
    expect(r.credits).toBe(CREDIT_PRICES['ads.image'] * 2)
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS - r.credits)
    await settleReservation(r.key, { costUsd: 0.04 })
    expect(await getBalance(id)).toBe(await ledgerSum(id))
    const row = await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: r.key } })
    expect(row).toMatchObject({ settled: true, costUsd: 0.04 })
  })

  it('throws InsufficientCreditsError with required and balance', async () => {
    const id = await newUser(2)
    const err = await reserveCredits({ userId: id, action: 'ads.aplus' }).catch((e) => e)
    expect(err).toBeInstanceOf(InsufficientCreditsError)
    expect(err).toMatchObject({ required: CREDIT_PRICES['ads.aplus'], balance: 2 })
    expect(await getBalance(id)).toBe(2)
  })

  it('concurrent reservations: exactly one succeeds when only one fits', async () => {
    const id = await newUser(CREDIT_PRICES['ads.aplus'])
    const results = await Promise.allSettled([
      reserveCredits({ userId: id, action: 'ads.aplus' }),
      reserveCredits({ userId: id, action: 'ads.aplus' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await getBalance(id)).toBe(0)
  })

  it('refund restores the balance, and a second refund is a no-op', async () => {
    const id = await newUser()
    const r = await reserveCredits({ userId: id, action: 'ads.aplus' })
    await refundReservation(r.key)
    await refundReservation(r.key)
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS)
    expect(await getBalance(id)).toBe(await ledgerSum(id))
  })

  it('settle after refund is a no-op (and vice versa)', async () => {
    const id = await newUser()
    const a = await reserveCredits({ userId: id, action: 'ads.image' })
    await refundReservation(a.key)
    await settleReservation(a.key)
    const b = await reserveCredits({ userId: id, action: 'ads.image' })
    await settleReservation(b.key)
    await refundReservation(b.key)
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS - CREDIT_PRICES['ads.image'])
  })

  it('partial settle refunds the unused units', async () => {
    const id = await newUser()
    const r = await reserveCredits({ userId: id, action: 'creator.illustrate', units: 4 })
    await settleReservation(r.key, { usedUnits: 1 })
    expect(await getBalance(id)).toBe(SIGNUP_CREDITS - CREDIT_PRICES['creator.illustrate'])
  })
})

describe('sweepStaleReservations', () => {
  it('refunds only unsettled, non-video reservations older than 30 minutes', async () => {
    const id = await newUser()
    const old = new Date(Date.now() - 31 * 60 * 1000)
    const stale = await reserveCredits({ userId: id, action: 'ads.image' })
    const video = await reserveCredits({ userId: id, action: 'ads.video.ai' })
    const fresh = await reserveCredits({ userId: id, action: 'landing.agent' })
    await prisma.creditLedger.updateMany({
      where: { idempotencyKey: { in: [stale.key, video.key] } },
      data: { createdAt: old },
    })

    await sweepStaleReservations({ force: true })

    expect(await getBalance(id)).toBe(SIGNUP_CREDITS - video.credits - fresh.credits)
  })
})

describe('platform daily limit', () => {
  it('refuses a reservation that would exceed PLATFORM_DAILY_CREDIT_LIMIT', async () => {
    const id = await newUser()
    const previous = process.env.PLATFORM_DAILY_CREDIT_LIMIT
    process.env.PLATFORM_DAILY_CREDIT_LIMIT = '0'
    try {
      await expect(reserveCredits({ userId: id, action: 'ads.image' })).rejects.toMatchObject({
        name: 'PlatformLimitError',
      })
      expect(await getBalance(id)).toBe(SIGNUP_CREDITS)
    } finally {
      process.env.PLATFORM_DAILY_CREDIT_LIMIT = previous
    }
  })
})
```

- [ ] **Step 3: Run to verify both fail**

Run: `npm test -- lib/credits`
Expected: FAIL — `adsGenerationAction`, `aiVideoUnits` and `./ledger` do not exist.

- [ ] **Step 4: Replace `lib/credits/prices.ts`**

```ts
/**
 * Credits charged per action (1 credit ≈ $0.10). The single source for both
 * the price shown in the UI and the amount charged.
 * See docs/superpowers/specs/2026-09-25-auth-and-credits-design.md.
 */
export const CREDIT_PRICES = {
  'ads.image': 3,
  'ads.aplus': 4,
  'ads.video.instant': 2,
  /** Legacy "all" projects, created before the picker lost its bundle card. */
  'ads.bundle': 9,
  /** Per 5-second block of AI video. */
  'ads.video.ai': 10,
  /** Per aspect ratio rendered. */
  'trailer.render': 2,
  'landing.agent': 2,
  /** Per 10 minutes of narrated audio. */
  'audiobook.tts': 1,
  'creator.generate': 3,
  /** Per image. */
  'creator.illustrate': 3,
} as const

export type CreditAction = keyof typeof CREDIT_PRICES

export type AdGoal = 'aplus' | 'sponsored' | 'video'

export function goalCreditLabel(goal: AdGoal): string {
  if (goal === 'aplus') return `${CREDIT_PRICES['ads.aplus']} credits`
  if (goal === 'sponsored') return `${CREDIT_PRICES['ads.image']} credits`
  return `from ${CREDIT_PRICES['ads.video.instant']} credits`
}

/** What `/api/ads/projects/:id/generate` charges for a book's stored content goal. */
export function adsGenerationAction(goal: string | null): CreditAction {
  if (goal === 'aplus') return 'ads.aplus'
  if (goal === 'sponsored') return 'ads.image'
  if (goal === 'video') return 'ads.video.instant'
  return 'ads.bundle'
}

/** AI video is priced per started 5-second block of each shot. */
export function aiVideoUnits(durationsSec: number[]): number {
  return durationsSec.reduce((total, d) => total + Math.max(1, Math.ceil(d / 5)), 0)
}
```

- [ ] **Step 5: Write `lib/credits/ledger.ts`**

```ts
import { randomUUID } from 'node:crypto'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { CREDIT_PRICES, type CreditAction } from './prices'

export const SIGNUP_CREDITS = 20

/** Any non-video action finishes inside a 300s route; 30 min means it crashed. */
const STALE_MS = 30 * 60 * 1000
const SWEEP_EVERY_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_PLATFORM_DAILY_CREDIT_LIMIT = 5000

export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public balance: number
  ) {
    super(`This needs ${required} credits and you have ${balance}.`)
    this.name = 'InsufficientCreditsError'
  }
}

export class PlatformLimitError extends Error {
  constructor() {
    super('Generation is paused for today while we scale up. Please try again later.')
    this.name = 'PlatformLimitError'
  }
}

export interface Reservation {
  key: string
  userId: string
  action: CreditAction
  units: number
  credits: number
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

/** Creates the user with their signup grant, exactly once, whichever caller gets there first. */
export async function ensureUser(id: string, getEmail: () => Promise<string>): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (existing) return existing

  const email = await getEmail()
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { id, email, balance: SIGNUP_CREDITS } })
      await tx.creditLedger.create({
        data: { userId: id, delta: SIGNUP_CREDITS, kind: 'signup_grant', settled: true, idempotencyKey: `signup:${id}` },
      })
      return user
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) return prisma.user.findUniqueOrThrow({ where: { id } })
    throw err
  }
}

export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
  return user?.balance ?? 0
}

// ponytail: counts reserved-minus-refunded credits across all users in the last
// 24h; a real spend cap in USD needs per-call costs, which only AI video reports today.
async function assertUnderPlatformLimit(credits: number): Promise<void> {
  const raw = Number(process.env.PLATFORM_DAILY_CREDIT_LIMIT)
  const limit = process.env.PLATFORM_DAILY_CREDIT_LIMIT?.trim() && Number.isFinite(raw) ? raw : DEFAULT_PLATFORM_DAILY_CREDIT_LIMIT
  const { _sum } = await prisma.creditLedger.aggregate({
    where: { kind: { in: ['reserve', 'refund'] }, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    _sum: { delta: true },
  })
  const spent = -(_sum.delta ?? 0)
  if (spent + credits > limit) throw new PlatformLimitError()
}

export async function reserveCredits(input: {
  userId: string
  action: CreditAction
  units?: number
  refId?: string
  key?: string
}): Promise<Reservation> {
  const units = input.units ?? 1
  if (!Number.isInteger(units) || units < 1) throw new Error(`units must be a positive integer, got ${units}`)
  const credits = CREDIT_PRICES[input.action] * units
  const key = input.key ?? `reserve:${randomUUID()}`

  void sweepStaleReservations().catch((err) => console.error('credit sweep failed', err))
  await assertUnderPlatformLimit(credits)

  await prisma.$transaction(async (tx) => {
    // Conditional decrement: the row lock makes concurrent reservations queue,
    // and the second one sees the already-reduced balance.
    const { count } = await tx.user.updateMany({
      where: { id: input.userId, balance: { gte: credits } },
      data: { balance: { decrement: credits } },
    })
    if (count === 0) {
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { balance: true } })
      throw new InsufficientCreditsError(credits, user?.balance ?? 0)
    }
    await tx.creditLedger.create({
      data: { userId: input.userId, delta: -credits, kind: 'reserve', action: input.action, refId: input.refId, idempotencyKey: key },
    })
  })

  return { key, userId: input.userId, action: input.action, units, credits }
}

/**
 * Closes a reservation. `usedUnits` below what was reserved refunds the
 * difference; omitted means everything reserved was used. Only the first
 * settle/refund of a key has any effect.
 */
export async function settleReservation(key: string, opts: { usedUnits?: number; costUsd?: number } = {}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.creditLedger.updateMany({
      where: { idempotencyKey: key, kind: 'reserve', settled: false },
      data: { settled: true, costUsd: opts.costUsd },
    })
    if (count === 0) return

    const row = await tx.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: key } })
    const reserved = -row.delta
    const used =
      opts.usedUnits === undefined
        ? reserved
        : Math.min(reserved, Math.max(0, opts.usedUnits) * CREDIT_PRICES[row.action as CreditAction])
    const refund = reserved - used
    if (refund <= 0) return

    await tx.creditLedger.create({
      data: { userId: row.userId, delta: refund, kind: 'refund', action: row.action, refId: row.refId, settled: true, idempotencyKey: `refund:${key}` },
    })
    await tx.user.update({ where: { id: row.userId }, data: { balance: { increment: refund } } })
  })
}

export function refundReservation(key: string): Promise<void> {
  return settleReservation(key, { usedUnits: 0 })
}

let lastSweep = 0

/**
 * Refunds reservations a crashed request never closed. AI video is excluded:
 * its jobs legitimately run for up to a day and are closed by the status poll.
 */
export async function sweepStaleReservations(opts: { force?: boolean; now?: number } = {}): Promise<number> {
  const now = opts.now ?? Date.now()
  if (!opts.force && now - lastSweep < SWEEP_EVERY_MS) return 0
  lastSweep = now

  const stale = await prisma.creditLedger.findMany({
    where: {
      kind: 'reserve',
      settled: false,
      createdAt: { lt: new Date(now - STALE_MS) },
      NOT: { action: 'ads.video.ai' },
    },
    select: { idempotencyKey: true },
  })
  for (const row of stale) await refundReservation(row.idempotencyKey)
  return stale.length
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- lib/credits`
Expected: PASS (all prices, ledger, schema tests).

- [ ] **Step 7: Commit**

```bash
git add lib/credits
git commit -m "feat(credits): ledger with reserve/settle/refund, signup grant and stale sweep"
```

---

### Task 3: `chargeCredits` wrapper and HTTP error mapping

**Files:**
- Create: `lib/credits/charge.ts`
- Test: `lib/credits/charge.test.ts`

**Interfaces:**
- Consumes: Task 2 ledger.
- Produces:
  - `chargeCredits<T>(input: { userId: string; action: CreditAction; units?: number; refId?: string; key?: string }, fn: (r: Reservation) => Promise<{ result: T; usedUnits?: number; costUsd?: number }>): Promise<T>`
  - `creditErrorResponse(err: unknown): Response | null` — 402 `{ error, code: 'insufficient_credits', required, balance }` or 503 `{ error, code: 'platform_limit' }`, else `null`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/credits/charge.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./ledger', async (orig) => {
  const actual = await orig<typeof import('./ledger')>()
  return {
    ...actual,
    reserveCredits: vi.fn(async (i) => ({ key: 'k1', userId: i.userId, action: i.action, units: i.units ?? 1, credits: 3 })),
    settleReservation: vi.fn(async () => {}),
    refundReservation: vi.fn(async () => {}),
  }
})

import { chargeCredits, creditErrorResponse } from './charge'
import { InsufficientCreditsError, PlatformLimitError, refundReservation, settleReservation } from './ledger'

describe('chargeCredits', () => {
  beforeEach(() => vi.clearAllMocks())

  it('settles with the reported cost on success', async () => {
    const out = await chargeCredits({ userId: 'u', action: 'ads.image' }, async () => ({ result: 'ok', costUsd: 0.04 }))
    expect(out).toBe('ok')
    expect(settleReservation).toHaveBeenCalledWith('k1', { usedUnits: undefined, costUsd: 0.04 })
  })

  it('refunds when usedUnits is 0 (fallback content)', async () => {
    await chargeCredits({ userId: 'u', action: 'landing.agent' }, async () => ({ result: 'x', usedUnits: 0 }))
    expect(settleReservation).toHaveBeenCalledWith('k1', { usedUnits: 0, costUsd: undefined })
  })

  it('refunds and rethrows when the work throws', async () => {
    const boom = new Error('boom')
    await expect(chargeCredits({ userId: 'u', action: 'ads.image' }, async () => { throw boom })).rejects.toBe(boom)
    expect(refundReservation).toHaveBeenCalledWith('k1')
    expect(settleReservation).not.toHaveBeenCalled()
  })
})

describe('creditErrorResponse', () => {
  it('maps insufficient credits to 402 with the numbers', async () => {
    const res = creditErrorResponse(new InsufficientCreditsError(4, 1))!
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ code: 'insufficient_credits', required: 4, balance: 1 })
  })

  it('maps the platform limit to 503', () => {
    expect(creditErrorResponse(new PlatformLimitError())!.status).toBe(503)
  })

  it('returns null for anything else', () => {
    expect(creditErrorResponse(new Error('x'))).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/credits/charge.test.ts`
Expected: FAIL — `./charge` not found.

- [ ] **Step 3: Write `lib/credits/charge.ts`**

```ts
import { NextResponse } from 'next/server'
import {
  InsufficientCreditsError,
  PlatformLimitError,
  refundReservation,
  reserveCredits,
  settleReservation,
  type Reservation,
} from './ledger'
import type { CreditAction } from './prices'

/**
 * The one way a route spends credits: reserve before the work, refund if it
 * throws, settle (fully or partly, via `usedUnits`) when it returns.
 * Return `usedUnits: 0` when the "result" is fallback/sample content.
 */
export async function chargeCredits<T>(
  input: { userId: string; action: CreditAction; units?: number; refId?: string; key?: string },
  fn: (reservation: Reservation) => Promise<{ result: T; usedUnits?: number; costUsd?: number }>
): Promise<T> {
  const reservation = await reserveCredits(input)
  let out: { result: T; usedUnits?: number; costUsd?: number }
  try {
    out = await fn(reservation)
  } catch (err) {
    await refundReservation(reservation.key)
    throw err
  }
  await settleReservation(reservation.key, { usedUnits: out.usedUnits, costUsd: out.costUsd })
  return out.result
}

export function creditErrorResponse(err: unknown): Response | null {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json(
      { error: err.message, code: 'insufficient_credits', required: err.required, balance: err.balance },
      { status: 402 }
    )
  }
  if (err instanceof PlatformLimitError) {
    return NextResponse.json({ error: err.message, code: 'platform_limit' }, { status: 503 })
  }
  return null
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- lib/credits/charge.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/credits/charge.ts lib/credits/charge.test.ts
git commit -m "feat(credits): chargeCredits wrapper and 402/503 mapping"
```

---

### Task 4: Auth hardening

**Files:**
- Modify: `lib/providers/auth.ts`, `lib/providers/auth.test.ts`
- Modify: `proxy.ts`
- Modify: `app/(platform)/layout.tsx`
- Modify: `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `components/platform/AccountChip.tsx` (drop the `/api/auth/logout` sign-out branch)
- Create: `instrumentation.ts`
- Create: `app/api/webhooks/clerk/route.ts`, `app/api/webhooks/clerk/route.test.ts`
- Delete: `app/api/auth/login/`, `app/api/auth/logout/`, `app/api/auth/session/`, `app/api/auth/auth.test.ts`, `components/auth/LoginForm.tsx`
- Modify: `.env.example` (add `CLERK_WEBHOOK_SIGNING_SECRET=`, `PLATFORM_DAILY_CREDIT_LIMIT=5000`; remove `AI_VIDEO_DAILY_LIMIT_USD`)

**Interfaces:**
- Consumes: `ensureUser` (Task 2).
- Produces: `requireCurrentPublisherId(): Promise<string>` — unchanged signature; now guarantees a `User` row exists. `isClerkConfigured()` unchanged. `DEV_PUBLISHER_ID` unchanged. `PUBLISHER_COOKIE` removed.

- [ ] **Step 1: Read the Clerk docs in `node_modules`**

Read `node_modules/@clerk/nextjs/dist/types/server/routeMatcher.d.ts` (deprecation note and migration link) and the `auth.protect` JSDoc under `node_modules/@clerk/nextjs/dist/types/app-router/server/auth.d.ts`. Confirm: in a route handler `auth.protect()` responds non-2xx for a signed-out request, and in a page it redirects to sign-in. If the installed version behaves differently, keep the same contract (signed-out API → 401/404, page → sign-in) and note it in the commit.

- [ ] **Step 2: Rewrite `lib/providers/auth.test.ts`**

Replace the cookie-related tests with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: Object.assign(vi.fn(), { protect: vi.fn(async () => ({ userId: 'user_clerk_1' })) }),
  currentUser: vi.fn(async () => ({ primaryEmailAddress: { emailAddress: 'reader@example.com' } })),
}))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), connection: vi.fn(async () => {}) }))
vi.mock('@/lib/credits/ledger', () => ({ ensureUser: vi.fn(async (id: string) => ({ id })) }))

import { auth } from '@clerk/nextjs/server'
import { ensureUser } from '@/lib/credits/ledger'
import { DEV_PUBLISHER_ID, requireCurrentPublisherId } from './auth'

const setKeys = (on: boolean) => {
  vi.stubEnv('CLERK_SECRET_KEY', on ? 'sk_test_real' : '')
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', on ? 'pk_test_real' : '')
}

describe('requireCurrentPublisherId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses auth.protect() and ensures the user row when Clerk is configured', async () => {
    setKeys(true)
    await expect(requireCurrentPublisherId()).resolves.toBe('user_clerk_1')
    expect(auth.protect).toHaveBeenCalled()
    expect(ensureUser).toHaveBeenCalledWith('user_clerk_1', expect.any(Function))
  })

  it('falls back to the dev publisher outside production', async () => {
    setKeys(false)
    vi.stubEnv('NODE_ENV', 'development')
    await expect(requireCurrentPublisherId()).resolves.toBe(DEV_PUBLISHER_ID)
    expect(ensureUser).toHaveBeenCalledWith(DEV_PUBLISHER_ID, expect.any(Function))
  })

  it('refuses the dev fallback in production', async () => {
    setKeys(false)
    vi.stubEnv('NODE_ENV', 'production')
    await expect(requireCurrentPublisherId()).rejects.toThrow(/Clerk/)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- lib/providers/auth.test.ts`
Expected: FAIL — the current code reads cookies and never calls `auth.protect` or `ensureUser`.

- [ ] **Step 4: Rewrite `lib/providers/auth.ts`**

```ts
import { auth, currentUser } from '@clerk/nextjs/server'
import { connection } from 'next/server'
import { ensureUser } from '@/lib/credits/ledger'

// Local mode: no Clerk keys (or the .env.example placeholders) means every
// request acts as one fixed local publisher — development only.
export const DEV_PUBLISHER_ID = 'dev-local-publisher'

const PLACEHOLDERS = ['sk_test_placeholder', 'pk_test_placeholder']

/**
 * Both keys, not just the secret: mounting ClerkProvider and clerkMiddleware
 * with a secret but no publishable key crashes the app at boot.
 */
export function isClerkConfigured(): boolean {
  const secret = process.env.CLERK_SECRET_KEY
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  return (
    Boolean(secret && publishable) &&
    !PLACEHOLDERS.includes(secret!) &&
    !PLACEHOLDERS.includes(publishable!)
  )
}

/**
 * The resource-level auth check (Clerk's replacement for middleware route
 * matching): signed-out page requests redirect to sign-in, signed-out API
 * requests get a non-2xx from Clerk. Also guarantees the user's credit row.
 */
export async function requireCurrentPublisherId(): Promise<string> {
  if (isClerkConfigured()) {
    const { userId } = await auth.protect()
    await ensureUser(userId, async () => (await currentUser())?.primaryEmailAddress?.emailAddress ?? '')
    return userId
  }

  // Marks the route dynamic, so pages never bake the dev publisher's data in at build time.
  await connection()
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Clerk keys are required in production; the local dev publisher is disabled.')
  }
  await ensureUser(DEV_PUBLISHER_ID, async () => 'dev@localhost')
  return DEV_PUBLISHER_ID
}
```

- [ ] **Step 5: Run the test**

Run: `npm test -- lib/providers/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Proxy, layout, boot guard, cookie login removal**

`proxy.ts`:

```ts
import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isClerkConfigured } from '@/lib/providers/auth'

// Auth is enforced per resource by requireCurrentPublisherId() (every API
// route and platform page calls it), not by path matching here — Clerk
// deprecated createRouteMatcher because matchers drift from Next's routing.
// Public by construction: /sign-in, /sign-up, /p/:slug, /api/webhooks/clerk.
export default isClerkConfigured() ? clerkMiddleware() : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

`app/(platform)/layout.tsx` — make it `async` and call `await requireCurrentPublisherId()` before rendering, so every platform page is protected even if a page forgets.

`instrumentation.ts`:

```ts
import { isClerkConfigured } from '@/lib/providers/auth'

export function register() {
  if (process.env.NODE_ENV === 'production' && !isClerkConfigured()) {
    throw new Error('Refusing to start: set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.')
  }
}
```

Sign-in/sign-up pages: when `!isClerkConfigured()`, render a short "Local mode — you're signed in as the local publisher" message with a link to `/` instead of `LoginForm`. Delete `app/api/auth/{login,logout,session}`, `app/api/auth/auth.test.ts`, `components/auth/LoginForm.tsx`. In `AccountChip.tsx`, delete the non-Clerk sign-out handler that POSTs `/api/auth/logout` (and its menu item); Clerk mode already uses `UserButton`. Run `grep -rn "api/auth\|PUBLISHER_COOKIE\|pt_publisher_id\|LoginForm" app components lib` → expect no hits.

- [ ] **Step 7: Clerk webhook — failing test**

```ts
// app/api/webhooks/clerk/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook: vi.fn() }))
vi.mock('@/lib/credits/ledger', () => ({ ensureUser: vi.fn(async () => ({})) }))

import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { ensureUser } from '@/lib/credits/ledger'
import { POST } from './route'

const req = () => new Request('http://localhost/api/webhooks/clerk', { method: 'POST', body: '{}' })

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unverifiable payload', async () => {
    vi.mocked(verifyWebhook).mockRejectedValueOnce(new Error('bad signature'))
    expect((await POST(req() as never)).status).toBe(400)
    expect(ensureUser).not.toHaveBeenCalled()
  })

  it('creates the user with their primary email on user.created', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'user.created',
      data: {
        id: 'user_1',
        primary_email_address_id: 'e2',
        email_addresses: [{ id: 'e1', email_address: 'old@x.com' }, { id: 'e2', email_address: 'main@x.com' }],
      },
    } as never)
    expect((await POST(req() as never)).status).toBe(200)
    const [id, getEmail] = vi.mocked(ensureUser).mock.calls[0]
    expect(id).toBe('user_1')
    expect(await getEmail()).toBe('main@x.com')
  })

  it('ignores other event types', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({ type: 'user.updated', data: {} } as never)
    expect((await POST(req() as never)).status).toBe(200)
    expect(ensureUser).not.toHaveBeenCalled()
  })
})
```

Run: `npm test -- app/api/webhooks/clerk` → FAIL (route missing).

- [ ] **Step 8: Write the webhook route**

```ts
// app/api/webhooks/clerk/route.ts
import type { NextRequest } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { ensureUser } from '@/lib/credits/ledger'

/** Signature-verified with CLERK_WEBHOOK_SIGNING_SECRET. Public: Clerk calls it signed-out. */
export async function POST(request: NextRequest) {
  let event
  try {
    event = await verifyWebhook(request)
  } catch {
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, primary_email_address_id, email_addresses } = event.data
    const email = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? ''
    await ensureUser(id, async () => email)
  }
  return Response.json({ ok: true })
}
```

Run: `npm test -- app/api/webhooks/clerk` → PASS (3 tests).

- [ ] **Step 9: Verify in the running app**

Run `npx tsc --noEmit` → no errors. Run `npm test` → all green (fix any test that still mocked `PUBLISHER_COOKIE` or imported the deleted routes by removing those cases). With the dev server running in local mode: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/ads/projects` → `200` (dev publisher); `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login` → `404`.

- [ ] **Step 10: Commit**

```bash
git add -A lib/providers proxy.ts instrumentation.ts "app/(platform)/layout.tsx" app/sign-in app/sign-up app/api/webhooks app/api/auth components/auth components/platform/AccountChip.tsx .env.example
git commit -m "fix(auth): remove cookie impersonation login; per-resource Clerk auth, signup webhook, prod boot guard"
```

---

### Task 5: Remove BYOK

**Files:**
- Delete: `app/api/settings/ai-key/` (route and any test)
- Modify: `lib/publisher/settings.ts` (remove `AiAccount`, `ai` field, `getPublisherAiCredentials`, the `ai` part of `redactSettings`/`RedactedPublisherSettings`)
- Modify: `components/platform/SettingsForm.tsx` (remove the AI key section)
- Modify: every caller of `getPublisherAiCredentials` (listed by `grep -rn getPublisherAiCredentials app lib components`): `app/api/ads/projects/[id]/generate/route.ts`, `app/api/ads/projects/[id]/video/ai/route.ts`, `app/api/ads/projects/[id]/video/ai/brief/route.ts`, `app/api/trailer/projects/[id]/generate/route.ts`, `app/api/landing/projects/[id]/agent/route.ts`, `app/api/creator/projects/route.ts`, `app/api/creator/projects/[id]/chapter/route.ts`, `app/api/creator/projects/[id]/illustrate/route.ts`, `app/(platform)/trailer/[projectId]/configure/page.tsx`
- Modify: `lib/providers/ai.ts` — update the `AiCredentials` doc comment: it now only carries a `model` override; `apiKey` stays for tests but no production caller sets it.

**Interfaces:**
- Produces: services keep their optional `credentials?: AiCredentials` parameter (callers now omit it). AI video routes read the key as `resolveApiKey()` (no argument).

- [ ] **Step 1: Delete `getPublisherAiCredentials` and the ai-key route, then let the compiler list the call sites**

Run: `npx tsc --noEmit 2>&1 | grep error`
Expected: one error per caller listed above.

- [ ] **Step 2: Fix each caller**

In each, delete the import and the `getPublisherAiCredentials(publisherId)` call, and stop passing `credentials` (omit the argument). Where a route checked `isAiConfigured({ apiKey: credentials.apiKey })`, use `isAiConfigured()`. In `video/ai/route.ts` replace both `resolveApiKey(await getPublisherAiCredentials(publisherId))` with `resolveApiKey()`, and change `NO_KEY` to `'AI video is not available right now.'` (users can no longer fix it themselves). In `illustrate/route.ts` change the no-key message to `'Illustrations are not available right now.'`.

- [ ] **Step 3: Remove the settings UI section**

In `SettingsForm.tsx`, delete the AI key/model section and any `ai` fields it reads from the settings response.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → no errors. `grep -rn "openRouterKey\|ai-key\|getPublisherAiCredentials" app lib components` → no hits. `npm test` → green; delete tests that only covered the removed key route/redaction, and update route tests that mocked `getPublisherAiCredentials` by removing that mock.

- [ ] **Step 5: Commit**

```bash
git add -A app lib components
git commit -m "refactor(ai): remove bring-your-own-key; all generation uses the platform key"
```

---

### Task 6: Charge ads generation and instant video

**Files:**
- Modify: `app/api/ads/projects/[id]/generate/route.ts`, its `route.test.ts`
- Modify: `app/api/ads/projects/[id]/video/instant/route.ts` (+ create `route.test.ts` if absent)

**Interfaces:**
- Consumes: `chargeCredits`, `creditErrorResponse` (Task 3); `adsGenerationAction` (Task 2).

- [ ] **Step 1: Failing tests** — add to `app/api/ads/projects/[id]/generate/route.test.ts` (keep its existing mocks; add this mock at the top):

```ts
vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' })).result) }
})
import { chargeCredits } from '@/lib/credits/charge'
import { InsufficientCreditsError } from '@/lib/credits/ledger'
```

```ts
it('charges the price of the book’s content goal', async () => {
  // arrange the existing happy-path fixture with contentGoal: 'aplus'
  await POST(new Request('http://localhost', { method: 'POST' }), ctx('book_1'))
  expect(chargeCredits).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'pub_1', action: 'ads.aplus', refId: 'book_1' }),
    expect.any(Function)
  )
})

it('returns 402 when the user cannot afford it', async () => {
  vi.mocked(chargeCredits).mockRejectedValueOnce(new InsufficientCreditsError(4, 1))
  const res = await POST(new Request('http://localhost', { method: 'POST' }), ctx('book_1'))
  expect(res.status).toBe(402)
})
```

(Use the file's existing request/ctx helpers and book fixture; set `contentGoal: 'aplus'` on the mocked book for the first test.)

Run: `npm test -- "app/api/ads/projects/\[id\]/generate"` → FAIL.

- [ ] **Step 2: Wrap the generation**

In `generate/route.ts`, move the body of the existing `try` into `chargeCredits`, returning the JSON payload as `result`:

```ts
import { chargeCredits, creditErrorResponse } from '@/lib/credits/charge'
import { adsGenerationAction } from '@/lib/credits/prices'
// ...
  try {
    const payload = await chargeCredits(
      { userId: publisherId, action: adsGenerationAction(book.contentGoal), refId: book.id },
      async () => {
        // ...existing work, unchanged, up to and including prisma.book.update(...)...
        const body = { creativeSetId, copySource: copyResult.source, videoError, warning }
        // A video-goal generation whose video failed delivered nothing it was bought for.
        return { result: body, usedUnits: book.contentGoal === 'video' && videoError ? 0 : undefined }
      }
    )
    return NextResponse.json(payload, { status: 201 })
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    console.error('ads generation failed', err)
    return NextResponse.json(
      { error: "We couldn't generate your creatives. Check your cover image and try again." },
      { status: 500 }
    )
  }
```

- [ ] **Step 3: Instant video** — same pattern in `video/instant/route.ts` with `{ userId: publisherId, action: 'ads.video.instant', refId: book.id }`, returning the existing `{ videoUrl, videoPosterUrl, videoDuration }` as `result`, and `creditErrorResponse(err)` checked first in the catch. Add a test with the same `chargeCredits` mock asserting `action: 'ads.video.instant'` and a 402 case.

- [ ] **Step 4: Run tests**

Run: `npm test -- app/api/ads` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/ads
git commit -m "feat(credits): charge ad generation by content goal and instant video exports"
```

---

### Task 7: Charge AI video; retire the per-publisher USD cap

**Files:**
- Modify: `lib/services/ads/aiVideoJob.ts`, `lib/services/ads/aiVideoJob.test.ts`
- Modify: `app/api/ads/projects/[id]/video/ai/route.ts` (+ its test)

**Interfaces:**
- Consumes: `reserveCredits`, `settleReservation`, `refundReservation` (Task 2); `aiVideoUnits` (Task 2); `creditErrorResponse` (Task 3).
- Produces: `startAiVideoJob(book, brief, apiKey, jobId?: string)` — when given, the job row is created with that id. Reservation key convention: `video:<jobId>`.

- [ ] **Step 1: Failing route tests** (add to the AI video route test; mock `@/lib/credits/ledger` `reserveCredits`/`settleReservation`/`refundReservation` as `vi.fn`s and `startAiVideoJob`/`advanceAiVideoJob` as the file already does):

```ts
it('reserves credits for every 5s block before starting, keyed by the job id', async () => {
  // brief with two 5s shots
  const res = await POST(jsonRequest({ brief: twoShotBrief }), ctx('book_1'))
  expect(res.status).toBe(202)
  const call = vi.mocked(reserveCredits).mock.calls[0][0]
  expect(call).toMatchObject({ userId: 'pub_1', action: 'ads.video.ai', units: 2 })
  expect(call.key).toBe(`video:${vi.mocked(startAiVideoJob).mock.calls[0][3]}`)
})

it('refunds when the job cannot be started', async () => {
  vi.mocked(startAiVideoJob).mockRejectedValueOnce(new AiVideoUserError('already running'))
  const res = await POST(jsonRequest({ brief: twoShotBrief }), ctx('book_1'))
  expect(res.status).toBe(400)
  expect(refundReservation).toHaveBeenCalledWith(vi.mocked(reserveCredits).mock.calls[0][0].key)
})

it('settles a completed job and refunds a failed one on poll', async () => {
  vi.mocked(advanceAiVideoJob).mockResolvedValueOnce({ ...jobRow, id: 'j1', status: 'completed', costUsd: 0.84 })
  await GET(new Request('http://localhost'), ctx('book_1'))
  expect(settleReservation).toHaveBeenCalledWith('video:j1', { costUsd: 0.84 })

  vi.mocked(advanceAiVideoJob).mockResolvedValueOnce({ ...jobRow, id: 'j2', status: 'failed' })
  await GET(new Request('http://localhost'), ctx('book_1'))
  expect(refundReservation).toHaveBeenCalledWith('video:j2')
})
```

(`twoShotBrief`, `jsonRequest`, `jobRow`: reuse the file's existing fixtures; give the brief two shots with `durationSec: 5`. Mock `prisma.aiVideoJob.findFirst` to return a `running` row so `advanceAiVideoJob` is called.)

Run → FAIL.

- [ ] **Step 2: `startAiVideoJob` accepts a job id; remove the daily cap**

In `aiVideoJob.ts`: add a 4th parameter `jobId?: string` and pass `id: jobId` into `prisma.aiVideoJob.create({ data: { id: jobId, ... } })` (Prisma ignores `id: undefined`). Delete `dailyLimitUsd`, `dailyLimitMessage`, `billedCost`, `assertUnderDailyCap` and its call. Delete the daily-cap tests in `aiVideoJob.test.ts`. Keep `shotsCostSoFar` (still used for `costUsd`).

- [ ] **Step 3: Route changes** in `video/ai/route.ts`

```ts
import { randomUUID } from 'node:crypto'
import { refundReservation, reserveCredits, settleReservation } from '@/lib/credits/ledger'
import { aiVideoUnits } from '@/lib/credits/prices'
import { creditErrorResponse } from '@/lib/credits/charge'
// POST, after apiKey check:
  const jobId = randomUUID()
  const key = `video:${jobId}`
  try {
    await reserveCredits({
      userId: publisherId,
      action: 'ads.video.ai',
      units: aiVideoUnits(parsed.data.brief.shots.map((s) => s.durationSec)),
      refId: book.id,
      key,
    })
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    throw err
  }
  try {
    const job = await startAiVideoJob(book, parsed.data.brief, apiKey, jobId)
    return NextResponse.json({ job: summarizeJob(job) }, { status: 202 })
  } catch (err) {
    // A job row may exist and already be failed; the refund key is the same either way.
    await refundReservation(key)
    if (err instanceof AiVideoUserError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('ai video start failed', err)
    return NextResponse.json({ error: 'The AI video could not be started. Please try again.' }, { status: 500 })
  }
```

In `GET`, after `job` is computed:

```ts
  // Idempotent: only the first settle/refund of a key applies, so every poll may call these.
  if (job?.status === 'completed') await settleReservation(`video:${job.id}`, { costUsd: job.costUsd ?? undefined })
  if (job?.status === 'failed') await refundReservation(`video:${job.id}`)
```

Check the job status names used by `summarizeJob`/`aiVideoJob.ts` (`running | stitching | completed | failed`) and use the exact completed value found there.

Note: jobs created before this change have no reservation; settle/refund of a missing key is a no-op (`updateMany` matches 0 rows).

- [ ] **Step 4: Run tests**

Run: `npm test -- lib/services/ads/aiVideoJob app/api/ads` → PASS.

- [ ] **Step 5: Show the price in the panel**

In `components/ads/AiVideoPanel.tsx`, next to the existing USD estimate, show `aiVideoUnits(shots.map(s => s.durationSec)) * CREDIT_PRICES['ads.video.ai']` credits on the start button: `Generate · {n} credits`. Remove the USD daily-cap copy if any.

- [ ] **Step 6: Commit**

```bash
git add lib/services/ads app/api/ads components/ads/AiVideoPanel.tsx
git commit -m "feat(credits): reserve AI video credits per 5s block; refund failed jobs; drop USD daily cap"
```

---

### Task 8: Charge trailer, landing, audiobook and creator

**Files:**
- Modify: `app/api/trailer/projects/[id]/generate/route.ts`
- Modify: `app/api/landing/projects/[id]/agent/route.ts`
- Modify: `app/api/audiobook/projects/[id]/generate/route.ts`
- Modify: `app/api/creator/projects/route.ts` (POST), `app/api/creator/projects/[id]/chapter/route.ts`, `app/api/creator/projects/[id]/illustrate/route.ts`
- Modify: `lib/services/creator/illustrate.ts` (export a request count)
- Tests: each route's `route.test.ts` (create where missing)

**Interfaces:**
- Produces: `countIllustrationRequests(input: { content: GeneratedBookContent; styleTheme: string; regenerate?: boolean; existingCoverUrl?: string | null }): number` in `illustrate.ts` — equals the `requested` that `illustrateProject` would return.

- [ ] **Step 1: `countIllustrationRequests` — failing test** in `lib/services/creator/illustrate.test.ts`:

```ts
it('counts the images an illustration run will request', async () => {
  const input = { content: sampleContent, styleTheme: 'watercolor', regenerate: false, existingCoverUrl: null }
  const result = await illustrateProject({ ...input, projectId: 'p', publisherId: 'pub', title: 'T' })
  expect(countIllustrationRequests(input)).toBe(result.requested)
})
```

(`sampleContent`: the fixture the file already uses for `illustrateProject` tests, with image generation mocked.)

- [ ] **Step 2: Implement** — in `illustrate.ts`, extract the prompt filter into a helper shared by both:

```ts
function pendingPrompts(content: GeneratedBookContent, styleTheme: string, regenerate?: boolean) {
  const bible = buildStyleBible(content, styleTheme)
  return collectPrompts(content, bible).filter((p) => regenerate || !hasImage(content, p.key))
}

export function countIllustrationRequests(input: {
  content: GeneratedBookContent
  styleTheme: string
  regenerate?: boolean
  existingCoverUrl?: string | null
}): number {
  const keepCover = Boolean(input.existingCoverUrl) && !input.regenerate
  return pendingPrompts(input.content, input.styleTheme, input.regenerate).length + (keepCover ? 0 : 1)
}
```

and in `illustrateProject` replace the `bible`/`prompts` lines with `const bible = buildStyleBible(content, input.styleTheme)` (still needed for the cover prompt if it uses it; keep it only if referenced) and `const prompts = pendingPrompts(content, input.styleTheme, input.regenerate)`. Run the illustrate tests → PASS.

- [ ] **Step 3: Route tests** — for each route below, add (with the `chargeCredits` mock from Task 6 Step 1) one test asserting the `chargeCredits` input and one asserting 402 on `InsufficientCreditsError`, plus where noted a fallback test:

| Route | `chargeCredits` input | `usedUnits` rule (test it) |
|---|---|---|
| trailer generate | `{ action: 'trailer.render', units: formats.length, refId: project.id }` | none |
| landing agent | `{ action: 'landing.agent', refId: project.id }` | `source === 'fallback'` → `0` |
| audiobook generate | `{ action: 'audiobook.tts', units: max(1, ceil(Σ estimateDuration(ch.content, pacing) / 600)), refId: project.id }` | none |
| creator POST | `{ action: 'creator.generate' }` | `source === 'fallback'` → `0` |
| creator chapter | `{ action: 'creator.generate', refId: project.id }` | `source === 'fallback'` → `0` if the service returns `source`; else none |
| creator illustrate | `{ action: 'creator.illustrate', units: countIllustrationRequests(...), refId: project.id }` | `usedUnits: result.succeeded` |

Fallback test shape (landing example):

```ts
it('does not charge for fallback copy', async () => {
  vi.mocked(runAuthorLandingAgent).mockResolvedValueOnce({ data: sampleLanding, source: 'fallback', reason: 'timeout' })
  let reported: { usedUnits?: number } | undefined
  vi.mocked(chargeCredits).mockImplementationOnce(async (_i, fn) => {
    const out = await fn({ key: 'k' } as never)
    reported = out
    return out.result
  })
  await POST(jsonRequest(validBody), ctx('landing_1'))
  expect(reported?.usedUnits).toBe(0)
})
```

Run → FAIL.

- [ ] **Step 4: Wrap each route** — same pattern as Task 6 Step 2: `const x = await chargeCredits(input, async () => { ...existing work...; return { result, usedUnits } })`, and in the route's catch (add a try/catch where the route has none, e.g. landing agent) put `const creditResponse = creditErrorResponse(err); if (creditResponse) return creditResponse` first. For illustrate, skip charging when `countIllustrationRequests(...) === 0` (nothing to draw — return the existing response without calling `chargeCredits`).

- [ ] **Step 5: Run tests**

Run: `npm test -- app/api lib/services/creator` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add app/api lib/services/creator
git commit -m "feat(credits): charge trailers, landing copy, narration and book creator actions"
```

---

### Task 9: Credits in the UI

**Files:**
- Create: `app/api/credits/balance/route.ts` (+ test)
- Create: `components/platform/CreditBalance.tsx`
- Create: `app/(platform)/credits/page.tsx`
- Modify: `components/platform/TopBar.tsx`
- Modify: `components/platform/GenerateRunner.tsx`
- Modify: Generate buttons — `components/ads/ConfigureForm.tsx`, `components/ads/InstantVideoCard.tsx`, `components/trailer/TrailerConfigureForm.tsx`, `components/audiobook/AudiobookConfigureForm.tsx`, `components/landing/LandingConfigureForm.tsx`, `components/creator/NewBookForm.tsx`, `components/creator/NovelChapterViewer.tsx`, `components/creator/BookProjectStudio.tsx`

**Interfaces:**
- Consumes: `getBalance` (Task 2), `CREDIT_PRICES`, `adsGenerationAction` (Task 2).
- Produces: `GET /api/credits/balance` → `{ balance: number }`. Browser event `credits:changed` (dispatched on `window`) makes the chip refetch.

- [ ] **Step 1: Balance route — failing test**

```ts
// app/api/credits/balance/route.test.ts
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/credits/ledger', () => ({ getBalance: vi.fn().mockResolvedValue(17) }))
import { GET } from './route'

describe('GET /api/credits/balance', () => {
  it('returns the caller’s balance, uncached', async () => {
    const res = await GET()
    expect(await res.json()).toEqual({ balance: 17 })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
```

- [ ] **Step 2: Route**

```ts
// app/api/credits/balance/route.ts
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance } from '@/lib/credits/ledger'

export async function GET() {
  const userId = await requireCurrentPublisherId()
  return Response.json({ balance: await getBalance(userId) }, { headers: { 'Cache-Control': 'no-store' } })
}
```

Run: `npm test -- app/api/credits` → PASS.

- [ ] **Step 3: Chip**

```tsx
// components/platform/CreditBalance.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Coins } from 'lucide-react'

export function CreditBalance() {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/credits/balance')
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setBalance(b.balance))
        .catch(() => {})
    load()
    window.addEventListener('credits:changed', load)
    window.addEventListener('focus', load)
    return () => {
      window.removeEventListener('credits:changed', load)
      window.removeEventListener('focus', load)
    }
  }, [])

  return (
    <Link
      href="/credits"
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink shadow-subtle hover:bg-surface"
      aria-label={balance === null ? 'Credits' : `${balance} credits`}
    >
      <Coins className="size-4 text-accent" aria-hidden />
      {balance ?? '–'}
    </Link>
  )
}
```

Add `<CreditBalance />` in `TopBar.tsx` before `<ThemeToggle />`.

- [ ] **Step 4: `/credits` page**

```tsx
// app/(platform)/credits/page.tsx
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance } from '@/lib/credits/ledger'
import { prisma } from '@/lib/db'

const LABELS: Record<string, string> = {
  signup_grant: 'Welcome credits',
  purchase: 'Purchase',
  reserve: 'Used',
  refund: 'Refund',
  adjust: 'Adjustment',
}

export default async function CreditsPage() {
  const userId = await requireCurrentPublisherId()
  const [balance, rows] = await Promise.all([
    getBalance(userId),
    prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Credits</h1>
      <p className="mt-2 text-ink-muted">
        You have <strong className="text-ink">{balance}</strong> credits. Buying more is coming soon.
      </p>
      <table className="mt-8 w-full text-sm">
        <thead className="text-left text-ink-muted">
          <tr><th className="py-2">Date</th><th>What</th><th>Action</th><th className="text-right">Credits</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="py-2">{r.createdAt.toLocaleDateString()}</td>
              <td>{LABELS[r.kind] ?? r.kind}</td>
              <td className="text-ink-muted">{r.action ?? ''}</td>
              <td className="text-right tabular-nums">{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: 402 in `GenerateRunner`**

Where it reads the error body (around line 90), also read `code`; when `res.status === 402`, render the error with a `Link href="/credits"` "See your credits" beneath it. After any response (ok or not) call `window.dispatchEvent(new Event('credits:changed'))`. Do the same dispatch after the direct `fetch` calls in `InstantVideoCard`, `AiVideoPanel`, `LandingConfigureForm`, `NewBookForm`, `NovelChapterViewer`, `BookProjectStudio`; those already toast `body.error`, which now carries the "This needs N credits and you have M." message.

- [ ] **Step 6: Price on every Generate button**

Append ` · {n} credits` to each Generate button's label, computed from `CREDIT_PRICES`:
- `ConfigureForm` (ads): `CREDIT_PRICES[adsGenerationAction(book.contentGoal)]`
- `InstantVideoCard`: `CREDIT_PRICES['ads.video.instant']`
- `TrailerConfigureForm`: `CREDIT_PRICES['trailer.render'] * selectedAspectRatios.length`
- `AudiobookConfigureForm`: `CREDIT_PRICES['audiobook.tts']` + " per 10 min"
- `LandingConfigureForm` (agent button): `CREDIT_PRICES['landing.agent']`
- `NewBookForm`, `NovelChapterViewer`: `CREDIT_PRICES['creator.generate']`
- `BookProjectStudio` (illustrate): `CREDIT_PRICES['creator.illustrate']` + " per image"

- [ ] **Step 7: Verify in the browser**

`npx tsc --noEmit` clean. With the dev server running: open `/ads`, confirm the chip shows `20` (fresh dev DB) and links to `/credits`, which lists "Welcome credits +20". Screenshot light and dark.

- [ ] **Step 8: Commit**

```bash
git add app components
git commit -m "feat(credits): balance chip, credits page, prices on generate buttons, 402 handling"
```

---

### Task 10: Security fixes — SSRF redirects, import rate limit, ownership sweep, audit

**Files:**
- Modify: `lib/services/extract/urlExtractor.ts`, `lib/services/extract/urlExtractor.test.ts`
- Create: `lib/rateLimit.ts`, `lib/rateLimit.test.ts`
- Modify: `app/api/extract-url/route.ts`
- Modify: route tests lacking a cross-user 404 case (found in Step 6)
- Modify: `docs/FOLLOWUPS.md`

- [ ] **Step 1: SSRF — failing test** (add to `urlExtractor.test.ts`):

```ts
it('refuses a redirect to a private address', async () => {
  vi.mocked(lookup)
    .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
    .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }] as never)
  const mockFetch = vi.fn().mockResolvedValueOnce(
    new Response(null, { status: 302, headers: { location: 'http://metadata.internal/latest' } })
  )

  await expect(extractBookFromUrl('https://example.com/book', 'pub_1', mockFetch as never)).rejects.toThrow(/cannot be reached/)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
})
```

Run → FAIL (fetch is called with `redirect: 'follow'`).

- [ ] **Step 2: Follow redirects manually, checking every hop**

In `urlExtractor.ts` add:

```ts
const MAX_REDIRECTS = 5

/** fetch that re-runs the public-address check on every redirect hop. */
async function fetchPublic(url: URL, fetchFn: typeof fetch): Promise<{ res: Response; finalUrl: URL }> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current)
    const res = await fetchFn(current.toString(), {
      headers: BROWSER_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const location = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !location) return { res, finalUrl: current }
    current = new URL(location, current)
  }
  throw new Error('That link redirects too many times.')
}
```

Use it in `extractBookFromUrl` (replacing `assertPublicUrl(url)` + the `fetchFn(...)` call; pass `finalUrl` to `parseBookHtml` and `storeCover`) and in `storeCover` (replacing `assertPublicUrl(imageUrl)` + its fetch). Run `npm test -- lib/services/extract` → PASS (existing tests still pass: the private-host test fails before any fetch).

- [ ] **Step 3: Rate limiter — failing test**

```ts
// lib/rateLimit.test.ts
import { describe, expect, it } from 'vitest'
import { rateLimited } from './rateLimit'

describe('rateLimited', () => {
  it('allows `limit` hits per window, then refuses until the window passes', () => {
    const key = `t_${Math.random()}`
    expect(rateLimited(key, 2, 1000, 0)).toBe(false)
    expect(rateLimited(key, 2, 1000, 10)).toBe(false)
    expect(rateLimited(key, 2, 1000, 20)).toBe(true)
    expect(rateLimited(key, 2, 1000, 1001)).toBe(false)
  })
})
```

- [ ] **Step 4: Implement**

```ts
// lib/rateLimit.ts
const hits = new Map<string, number[]>()

// ponytail: per-instance memory, so the effective limit is `limit × instances`;
// move to Redis or a DB counter if the free import gets abused.
export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  const limited = recent.length >= limit
  if (!limited) recent.push(now)
  hits.set(key, recent)
  return limited
}
```

In `app/api/extract-url/route.ts`, right after `requireCurrentPublisherId()`:

```ts
if (rateLimited(`extract:${publisherId}`, 20, 60 * 60 * 1000)) {
  return NextResponse.json({ error: 'Too many imports this hour. Please try again later.' }, { status: 429 })
}
```

Run `npm test -- lib/rateLimit` → PASS.

- [ ] **Step 5: Upload limits check**

For each of `app/api/{audiobook,trailer,ads,landing}/projects/route.ts`, `app/api/trailer/projects/[id]/route.ts`, `app/api/ads/projects/[id]/route.ts`, `app/api/ads/projects/[id]/music/route.ts`: confirm every `File` taken from `formData` passes `validateFile(file, RULE)` (from `lib/services/shared/upload.ts`) or `storeUploadedImage` (which validates) before it is read. Where one does not, add the `validateFile` call returning 400 with its message, and a test posting an oversized file expecting 400. Record which routes needed it in the commit message.

- [ ] **Step 6: Ownership sweep**

List `[id]` routes: `find app/api -path '*\[id\]*' -name route.ts`. For each, check its `route.test.ts` has a case where the owner lookup (`get*ForPublisher` / `findFirst({ where: { id, publisherId } })`) returns null and the route answers 404. Add the missing ones using this shape:

```ts
it('returns 404 for another publisher’s project', async () => {
  vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
  const res = await POST(new Request('http://localhost', { method: 'POST' }), ctx('someone_elses'))
  expect(res.status).toBe(404)
})
```

If a route looks up by id without the publisher filter, fix the query to include `publisherId` — that is a real bug; note it in the commit.

- [ ] **Step 7: `npm audit`**

Run `npm audit --omit=dev`. Fix high/critical with `npm audit fix` (no `--force`). Anything that needs a major bump goes to `docs/FOLLOWUPS.md` with the advisory id.

- [ ] **Step 8: FOLLOWUPS**

In `docs/FOLLOWUPS.md`: remove the two items under "Before anyone sets a real Clerk key" (fixed). Add under a new "Security" heading: "**DNS rebinding in the URL importer.** `assertPublicUrl` resolves the host, then `fetch` resolves it again; a rebinding DNS server can answer differently. Pinning the checked IP needs a custom `undici` dispatcher." and "**Rate limit is per instance** (`lib/rateLimit.ts`)."

- [ ] **Step 9: Run everything and commit**

Run: `npx tsc --noEmit && npm test` → green.

```bash
git add -A lib app docs/FOLLOWUPS.md package.json package-lock.json
git commit -m "fix(security): check every redirect hop in the URL importer, rate-limit imports, ownership tests"
```

---

### Task 11: Ops scripts, E2E, docs

**Files:**
- Create: `scripts/credit-report.mjs`, `scripts/grant-credits.mjs`
- Create: `e2e/credits.spec.ts`
- Modify: `e2e/ads.spec.ts` (button name now includes the price)
- Modify: `README.md` (Clerk setup: keys, webhook endpoint `/api/webhooks/clerk` subscribed to `user.created`, `CLERK_WEBHOOK_SIGNING_SECRET`, enable email verification + bot protection in the Clerk dashboard; `PLATFORM_DAILY_CREDIT_LIMIT`; the two scripts)

- [ ] **Step 1: `scripts/grant-credits.mjs`**

```js
// Support/ops: node scripts/grant-credits.mjs <userId> <credits> [reason]
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const [userId, raw, reason = 'manual'] = process.argv.slice(2)
const credits = Number(raw)
if (!userId || !Number.isInteger(credits) || credits === 0) {
  console.error('usage: node scripts/grant-credits.mjs <userId> <credits> [reason]')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  await prisma.$transaction([
    prisma.creditLedger.create({
      data: { userId, delta: credits, kind: 'adjust', action: reason, settled: true, idempotencyKey: `adjust:${randomUUID()}` },
    }),
    prisma.user.update({ where: { id: userId }, data: { balance: { increment: credits } } }),
  ])
  const { balance } = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  console.log(`${userId}: ${credits > 0 ? '+' : ''}${credits} → balance ${balance}`)
} finally {
  await prisma.$disconnect()
}
```

- [ ] **Step 2: `scripts/credit-report.mjs`**

```js
// Margin per action: node scripts/credit-report.mjs [days=30]
import { PrismaClient } from '@prisma/client'

const days = Number(process.argv[2] ?? 30)
const prisma = new PrismaClient()
try {
  const rows = await prisma.$queryRaw`
    SELECT r.action,
           COUNT(*)::int                                   AS runs,
           SUM(-r.delta - COALESCE(f.delta, 0))::int        AS credits_charged,
           SUM(r."costUsd")                                 AS cost_usd,
           COUNT(*) FILTER (WHERE r."costUsd" IS NULL)::int AS cost_unknown
    FROM "CreditLedger" r
    LEFT JOIN "CreditLedger" f ON f."idempotencyKey" = 'refund:' || r."idempotencyKey"
    WHERE r.kind = 'reserve' AND r.settled AND r."createdAt" > now() - make_interval(days => ${days})
    GROUP BY r.action ORDER BY credits_charged DESC`
  console.table(
    rows.map((r) => ({
      ...r,
      revenue_usd: (r.credits_charged * 0.1).toFixed(2),
      cost_usd: r.cost_usd == null ? '—' : Number(r.cost_usd).toFixed(2),
      margin: r.cost_usd ? `${((r.credits_charged * 0.1) / Number(r.cost_usd)).toFixed(1)}×` : '—',
    }))
  )
} finally {
  await prisma.$disconnect()
}
```

Verify both against the dev DB: `node scripts/grant-credits.mjs dev-local-publisher 5 test` prints the new balance; `node scripts/credit-report.mjs` prints a table without error.

- [ ] **Step 3: E2E** — `e2e/credits.spec.ts`, following the patterns and fixtures in `e2e/ads.spec.ts` (local mode, dev publisher):

```ts
import { expect, test } from '@playwright/test'

test('the header shows the credit balance and links to the credits page', async ({ page }) => {
  await page.goto('/ads')
  const chip = page.getByRole('link', { name: /credits$/ })
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
  await expect(page.getByText('Welcome credits')).toBeVisible()
})

test('generating ads lowers the balance by the goal price', async ({ page }) => {
  const balance = async () => {
    const chip = page.getByRole('link', { name: /^\d+ credits$/ })
    await expect(chip).toBeVisible()
    return Number((await chip.getAttribute('aria-label'))!.split(' ')[0])
  }

  // Same upload → details → configure steps as e2e/ads.spec.ts (default goal: Image Ads).
  await page.goto('/ads/new')
  const before = await balance()
  await page.locator('#pdf').setInputFiles(fixture('sample-book.pdf'))
  await page.getByRole('button', { name: 'Upload and continue' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/upload$/)
  if (await page.getByText('Add one to continue').isVisible()) {
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  } else {
    await page.getByRole('button', { name: 'Replace cover' }).click()
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  }
  await page.getByLabel('Title').fill('Credits Test')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page).toHaveURL(/\/configure$/)
  await expect(page.getByRole('button', { name: /Generate creatives · 3 credits/ })).toBeVisible()
  await page.getByRole('button', { name: /Generate creatives/ }).click()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })

  await page.reload()
  expect(before - (await balance())).toBe(3)
})
```

Add `import path from 'node:path'` and `const fixture = (name: string) => path.join(__dirname, 'fixtures', name)` at the top of the file. If `#pdf` is not visible on `/ads/new` (the form now opens on the Product URL tab), click the "Upload PDF (Optional)" tab first — do the same in `e2e/ads.spec.ts` if it fails there.

Also update `e2e/ads.spec.ts`: its `getByRole('button', { name: 'Generate creatives' })` must become `{ name: /Generate creatives/ }`, since the label now ends in the price.

Run `npm run test:e2e -- e2e/credits.spec.ts` → PASS.

- [ ] **Step 4: README section** — add "Accounts & credits" covering the items listed under Files above.

- [ ] **Step 5: Final verification (QA gate)**

Run: `npx tsc --noEmit && npm test && npm run test:e2e` → all pass.

- [ ] **Step 6: Commit**

```bash
git add scripts e2e README.md
git commit -m "feat(credits): margin report, manual grant script, e2e and setup docs"
```
