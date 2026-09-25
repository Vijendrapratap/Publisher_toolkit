import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', bullets: [], categories: [], interiorImageUrls: ['/p1.png'],
  customHook: null, ctaText: 'Buy now', videoStyle: null, videoFormat: '1:1', videoLength: null, videoMood: null, videoSpec: null,
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/aiVideoBrief', () => ({ generateAiVideoBrief: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ rateLimited: vi.fn().mockReturnValue(false) }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAiVideoBrief } from '@/lib/services/ads/aiVideoBrief'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'
import { rateLimited } from '@/lib/rateLimit'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/ads/projects/:id/video/ai/brief', () => {
  let prevApiKey: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    prevApiKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'sk'
  })

  afterEach(() => {
    if (prevApiKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = prevApiKey
  })

  it('writes a brief from the book facts in the video format', async () => {
    const brief = fallbackBrief({ title: 'T', pageCount: 1 })
    vi.mocked(generateAiVideoBrief).mockResolvedValue({ data: brief, source: 'ai' })
    const res = await POST(req({ instruction: 'warm' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ brief, source: 'ai' })
    expect(generateAiVideoBrief).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', cta: 'Buy now', pageCount: 1 }),
      { current: undefined, instruction: 'warm', format: '1:1' }
    )
  })

  it('needs the platform AI key', async () => {
    delete process.env.OPENROUTER_API_KEY
    const res = await POST(req({}), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not available/i)
  })

  it('rejects an invalid current brief', async () => {
    const res = await POST(req({ current: { shots: [] } }), ctx)
    expect(res.status).toBe(400)
  })

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    const res = await POST(req({}), ctx)
    expect(res.status).toBe(404)
  })

  it('rate-limits repeated brief requests per publisher', async () => {
    vi.mocked(rateLimited).mockReturnValueOnce(true)
    const res = await POST(req({}), ctx)
    expect(res.status).toBe(429)
    expect(rateLimited).toHaveBeenCalledWith('brief:pub_1', 30, 60 * 60 * 1000)
    expect(generateAiVideoBrief).not.toHaveBeenCalled()
  })
})
