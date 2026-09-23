import { describe, it, expect, vi, beforeEach } from 'vitest'

const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', bullets: [], categories: [], interiorImageUrls: ['/p1.png'],
  customHook: null, ctaText: 'Buy now', videoStyle: null, videoFormat: '1:1', videoLength: null, videoMood: null, videoSpec: null,
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/publisher/settings', () => ({ getPublisherAiCredentials: vi.fn() }))
vi.mock('@/lib/services/ads/aiVideoBrief', () => ({ generateAiVideoBrief: vi.fn() }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { generateAiVideoBrief } from '@/lib/services/ads/aiVideoBrief'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/ads/projects/:id/video/ai/brief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: 'sk', model: null })
  })

  it('writes a brief from the book facts in the video format', async () => {
    const brief = fallbackBrief({ title: 'T', pageCount: 1 })
    vi.mocked(generateAiVideoBrief).mockResolvedValue({ data: brief, source: 'ai' })
    const res = await POST(req({ instruction: 'warm' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ brief, source: 'ai' })
    expect(generateAiVideoBrief).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', cta: 'Buy now', pageCount: 1 }),
      { current: undefined, instruction: 'warm', format: '1:1' },
      { apiKey: 'sk', model: null }
    )
  })

  it('needs an OpenRouter key', async () => {
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: null, model: null })
    const prev = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    try {
      const res = await POST(req({}), ctx)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/OpenRouter/)
    } finally {
      if (prev === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = prev
    }
  })

  it('rejects an invalid current brief', async () => {
    const res = await POST(req({ current: { shots: [] } }), ctx)
    expect(res.status).toBe(400)
  })
})
