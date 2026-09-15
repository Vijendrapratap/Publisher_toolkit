import { describe, it, expect } from 'vitest'
import { pushCreativeSet } from './adsPush'

describe('pushCreativeSet (local)', () => {
  it('returns a simulated receipt naming the campaign', async () => {
    const receipt = await pushCreativeSet({ platform: 'META', bookTitle: 'The Lazy Developer', imageCount: 2 })
    expect(receipt.status).toBe('simulated')
    expect(receipt.platform).toBe('META')
    expect(receipt.campaignName).toBe('The Lazy Developer — Meta campaign')
    expect(receipt.receiptId).toMatch(/^sim_[a-z0-9]{8}$/)
    expect(Number.isNaN(Date.parse(receipt.createdAt))).toBe(false)
  })
})
