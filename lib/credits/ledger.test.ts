import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  const videoBookIds: string[] = []

  afterEach(async () => {
    await prisma.aiVideoJob.deleteMany({ where: { bookId: { in: videoBookIds } } })
    await prisma.book.deleteMany({ where: { id: { in: videoBookIds } } })
    videoBookIds.length = 0
  })

  const newVideoJob = async (status: string, costUsd: number | null = null) => {
    const book = await prisma.book.create({ data: { publisherId: `${PREFIX}pub` } })
    videoBookIds.push(book.id)
    return prisma.aiVideoJob.create({ data: { bookId: book.id, status, model: 'm', format: '16:9', brief: {}, shots: [], costUsd } })
  }

  it('refunds stale non-video reservations; for video ones, follows the job: held while running, refunded if failed or missing, settled (no refund) if completed', async () => {
    const startingBalance = 1000
    const id = await newUser(startingBalance)
    const old = new Date(Date.now() - 31 * 60 * 1000)

    const staleNonVideo = await reserveCredits({ userId: id, action: 'ads.image' })
    const fresh = await reserveCredits({ userId: id, action: 'landing.agent' })

    const runningJob = await newVideoJob('running')
    const runningRes = await reserveCredits({ userId: id, action: 'ads.video.ai', key: `video:${runningJob.id}` })

    const missingRes = await reserveCredits({ userId: id, action: 'ads.video.ai', key: `video:${randomUUID()}` })

    const failedJob = await newVideoJob('failed')
    const failedRes = await reserveCredits({ userId: id, action: 'ads.video.ai', key: `video:${failedJob.id}` })

    const completedJob = await newVideoJob('completed', 0.5)
    const completedRes = await reserveCredits({ userId: id, action: 'ads.video.ai', key: `video:${completedJob.id}` })

    await prisma.creditLedger.updateMany({
      where: { idempotencyKey: { in: [staleNonVideo.key, runningRes.key, missingRes.key, failedRes.key, completedRes.key] } },
      data: { createdAt: old },
    })

    await sweepStaleReservations({ force: true })

    // Held/settled reservations still count against the balance; refunded ones don't.
    expect(await getBalance(id)).toBe(startingBalance - fresh.credits - runningRes.credits - completedRes.credits)

    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: staleNonVideo.key } })).settled).toBe(true)
    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: runningRes.key } })).settled).toBe(false)
    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: missingRes.key } })).settled).toBe(true)
    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: failedRes.key } })).settled).toBe(true)
    expect(await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: completedRes.key } })).toMatchObject({
      settled: true,
      costUsd: 0.5,
    })
  })

  it('does not let one row that throws while processing block the rest from being refunded', async () => {
    const startingBalance = 1000
    const id = await newUser(startingBalance)
    const old = new Date(Date.now() - 31 * 60 * 1000)

    const throwingJob = await newVideoJob('failed')
    const throwingRes = await reserveCredits({ userId: id, action: 'ads.video.ai', key: `video:${throwingJob.id}` })
    const staleNonVideo = await reserveCredits({ userId: id, action: 'ads.image' })

    await prisma.creditLedger.updateMany({
      where: { idempotencyKey: { in: [throwingRes.key, staleNonVideo.key] } },
      data: { createdAt: old },
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const realFindUnique = prisma.aiVideoJob.findUnique.bind(prisma.aiVideoJob)
    const findUniqueSpy = vi
      .spyOn(prisma.aiVideoJob, 'findUnique')
      .mockImplementation(((args: any) =>
        args.where.id === throwingJob.id ? Promise.reject(new Error('boom')) : realFindUnique(args)) as never)

    await sweepStaleReservations({ force: true })

    // The row that threw is left unsettled for a later sweep to retry...
    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: throwingRes.key } })).settled).toBe(false)
    // ...but the other stale row was still refunded.
    expect((await prisma.creditLedger.findUniqueOrThrow({ where: { idempotencyKey: staleNonVideo.key } })).settled).toBe(true)
    expect(await getBalance(id)).toBe(startingBalance - throwingRes.credits)
    expect(consoleErrorSpy).toHaveBeenCalled()

    findUniqueSpy.mockRestore()
    consoleErrorSpy.mockRestore()
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
