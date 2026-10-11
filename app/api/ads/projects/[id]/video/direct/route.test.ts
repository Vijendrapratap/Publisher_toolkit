import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultVideoSpec, presetStyle } from '@/lib/services/ads/videoSpec'
import { fixedStoryboard } from '@/lib/services/ads/storyboard'

const style = presetStyle('cinematic')
const directed = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', bullets: [], categories: [], frontCoverUrl: '/api/files/ads/pub_1/c.png',
  interiorImageUrls: ['/api/files/ads/pub_1/p1.png'], customHook: null, ctaText: null, videoStyle: null, videoFormat: null,
  videoLength: null, videoMood: null, videoSpec: defaultVideoSpec({ title: 'T' }),
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/providers/ai', () => ({ isAiConfigured: vi.fn(() => true) }))
vi.mock('@/lib/rateLimit', () => ({ rateLimited: vi.fn(() => false) }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/videoAssets', () => ({ directorImages: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/services/ads/adDirector', () => ({ directAd: vi.fn(), drawSetting: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { book: { update: vi.fn().mockResolvedValue({}) } } }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { directAd, drawSetting } from '@/lib/services/ads/adDirector'
import { rateLimited } from '@/lib/rateLimit'
import { prisma } from '@/lib/db'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = (body: object = {}) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
  vi.mocked(directAd).mockResolvedValue({ source: 'ai', data: { ...directed, theme: { ...directed.theme, settingPrompt: 'library desk' } } })
  vi.mocked(drawSetting).mockResolvedValue('/api/files/ads/pub_1/settings/s.png')
})

describe('POST /api/ads/projects/:id/video/direct', () => {
  it('directs, draws the setting once, saves and returns the spec', async () => {
    const res = await POST(req(), ctx)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.source).toBe('ai')
    expect(json.spec.storyboard.theme.settingImageUrl).toBe('/api/files/ads/pub_1/settings/s.png')
    expect(drawSetting).toHaveBeenCalledWith('library desk', '16:9', 'pub_1')
    expect(vi.mocked(prisma.book.update).mock.calls[0][0]).toMatchObject({ where: { id: 'book_1' }, data: { videoSpec: json.spec } })
  })

  it('keeps the existing setting picture when a revision keeps the same setting', async () => {
    const saved = { ...directed, theme: { ...directed.theme, settingPrompt: 'library desk', settingImageUrl: '/api/files/ads/pub_1/settings/old.png' } }
    vi.mocked(getBookForPublisher).mockResolvedValue({ ...book, videoSpec: { ...book.videoSpec, storyboard: saved } } as any)
    const json = await (await POST(req({ revise: true, instruction: 'shorter' }), ctx)).json()
    expect(vi.mocked(directAd).mock.calls[0][2]).toMatchObject({ current: saved, instruction: 'shorter' })
    expect(drawSetting).not.toHaveBeenCalled()
    expect(json.spec.storyboard.theme.settingImageUrl).toBe('/api/files/ads/pub_1/settings/old.png')
  })

  it('does not draw anything when the AI fell back', async () => {
    vi.mocked(directAd).mockResolvedValue({ source: 'fallback', data: directed })
    await POST(req(), ctx)
    expect(drawSetting).not.toHaveBeenCalled()
  })

  it('refuses over the rate limit and for another publisher’s book', async () => {
    vi.mocked(rateLimited).mockReturnValueOnce(true)
    expect((await POST(req(), ctx)).status).toBe(429)
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(req(), ctx)).status).toBe(404)
  })
})
