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
