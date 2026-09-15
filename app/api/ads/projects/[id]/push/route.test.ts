import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn(), getLatestCreativeSetForBook: vi.fn() }))
vi.mock('@/lib/providers/adsPush', () => ({ pushCreativeSet: vi.fn() }))

import { POST } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { pushCreativeSet } from '@/lib/providers/adsPush'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body: unknown) =>
  new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/ads/projects/:id/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ images: [{ platform: 'META' }, { platform: 'GOOGLE' }] } as any)
  })

  it("pushes the latest set's images for the chosen platform", async () => {
    vi.mocked(pushCreativeSet).mockResolvedValue({ receiptId: 'sim_12345678', platform: 'META', campaignName: 'c', status: 'simulated', createdAt: '2026-09-15T00:00:00.000Z' })
    const res = await POST(req({ platform: 'META' }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect((await res.json()).receiptId).toBe('sim_12345678')
    expect(pushCreativeSet).toHaveBeenCalledWith({ platform: 'META', bookTitle: 'T', imageCount: 1 })
  })

  it('rejects Amazon and unknown platforms', async () => {
    expect((await POST(req({ platform: 'AMAZON' }), ctx('book_1'))).status).toBe(400)
    expect(pushCreativeSet).not.toHaveBeenCalled()
  })

  it('returns 400 when nothing is generated and 404 for a foreign book', async () => {
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValueOnce(null)
    expect((await POST(req({ platform: 'META' }), ctx('book_1'))).status).toBe(400)
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(req({ platform: 'META' }), ctx('book_1'))).status).toBe(404)
  })
})
