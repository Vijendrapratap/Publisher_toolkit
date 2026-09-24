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
