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
