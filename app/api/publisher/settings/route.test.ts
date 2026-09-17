import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_test_settings'),
}))

import { GET, PATCH } from './route'

describe('GET & PATCH /api/publisher/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns default settings for the publisher', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.publisherId).toBe('pub_test_settings')
    expect(data.brand).toBeDefined()
    expect(data.metaConnector).toBeDefined()
    expect(data.googleConnector).toBeDefined()
  })

  it('PATCH updates settings and returns the merged object', async () => {
    const req = new Request('http://localhost/api/publisher/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: { name: 'Acme Publishing House' },
        metaConnector: { adAccountId: 'act_acme_123', status: 'connected' },
      }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.brand.name).toBe('Acme Publishing House')
    expect(data.metaConnector.adAccountId).toBe('act_acme_123')
  })

  it('PATCH returns 400 on malformed input', async () => {
    const req = new Request('http://localhost/api/publisher/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
