import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultVideoSpec } from '@/lib/services/ads/videoSpec'

vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' })).result) }
})

const savedSpec = defaultVideoSpec({ title: 'Saved hook' })
const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/api/files/ads/pub_1/cover.png', interiorImageUrls: [],
  customHook: null, ctaText: null, videoStyle: null, videoFormat: null, videoLength: null, videoMood: null, videoSpec: savedSpec,
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({
  getBookForPublisher: vi.fn(),
  getLatestCreativeSetForBook: vi.fn(),
}))
vi.mock('@/lib/services/ads/videoAssets', () => ({
  bookAdImages: vi.fn().mockResolvedValue({ coverUrl: 'data:cover', pageUrls: [], settingUrl: null }),
  inlineMusic: vi.fn().mockResolvedValue('data:audio/mpeg;base64,AA'),
}))
vi.mock('@/lib/services/ads/renderVideo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/ads/renderVideo')>()),
  renderAdVideo: vi.fn(),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })),
}))
vi.mock('@/lib/db', () => ({ prisma: { creativeSet: { update: vi.fn().mockResolvedValue({}) } } }))

import { POST } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { AdVideoRenderError, renderAdVideo } from '@/lib/services/ads/renderVideo'
import { inlineMusic } from '@/lib/services/ads/videoAssets'
import { prisma } from '@/lib/db'
import { chargeCredits } from '@/lib/credits/charge'
import { InsufficientCreditsError } from '@/lib/credits/ledger'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = () => new Request('http://localhost', { method: 'POST' })

describe('POST /api/ads/projects/:id/video/instant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ id: 'set_1' } as any)
    vi.mocked(renderAdVideo).mockResolvedValue({
      videoBuffer: Buffer.from('mp4'), posterBuffer: Buffer.from('png'), durationSec: 15, width: 1920, height: 1080,
    })
  })

  it('renders the BookAd composition with the book’s storyboard', async () => {
    await POST(req(), ctx)
    const [props, compositionId] = vi.mocked(renderAdVideo).mock.calls[0]
    expect(compositionId).toBe('BookAd')
    expect((props as any).storyboard.beats.at(-1).kind).toBe('endCard')
    expect((props as any).coverUrl).toBe('data:cover')
  })

  it('renders the saved spec and replaces the set video', async () => {
    const res = await POST(req(), ctx)
    expect(res.status).toBe(200)
    expect(renderAdVideo).toHaveBeenCalledWith(
      expect.objectContaining({ spec: savedSpec, coverUrl: 'data:cover', title: 'T', musicSrc: 'data:audio/mpeg;base64,AA' }),
      'BookAd'
    )
    const json = await res.json()
    expect(json.videoUrl).toMatch(/creatives\/set_1\/video-.+\.mp4$/)
    expect(prisma.creativeSet.update).toHaveBeenCalledWith({
      where: { id: 'set_1' },
      data: { videoUrl: json.videoUrl, videoPosterUrl: json.videoPosterUrl, videoDuration: 15 },
    })
  })

  it('resolves music scoped to the requesting publisher, never another one’s upload', async () => {
    await POST(req(), ctx)
    expect(inlineMusic).toHaveBeenCalledWith(expect.anything(), 'pub_1')
  })

  it('asks for a generated campaign first', async () => {
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue(null as any)
    expect((await POST(req(), ctx)).status).toBe(400)
  })

  it('turns a missing-bundle error into a plain, engine-free message', async () => {
    vi.mocked(renderAdVideo).mockRejectedValue(new AdVideoRenderError('The video bundle is missing. Run `npm run remotion:bundle` and try again.'))
    const res = await POST(req(), ctx)
    expect(res.status).toBe(500)
    const { error } = await res.json()
    expect(error).toBe("Video export isn't set up on this server yet. Please contact support.")
    expect(error).not.toMatch(/remotion/i)
  })

  it('turns any other render error into a generic readable 500', async () => {
    vi.mocked(renderAdVideo).mockRejectedValue(new Error('headless Chrome crashed'))
    const res = await POST(req(), ctx)
    expect(res.status).toBe(500)
    const { error } = await res.json()
    expect(error).toBe('We couldn’t export the video. Please try again.')
    expect(error).not.toMatch(/remotion/i)
  })

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValue(null)
    expect((await POST(req(), ctx)).status).toBe(404)
  })

  it('charges for the instant video export', async () => {
    await POST(req(), ctx)
    expect(chargeCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pub_1', action: 'ads.video.instant', refId: 'book_1' }),
      expect.any(Function)
    )
  })

  it('returns 402 when the user cannot afford it', async () => {
    vi.mocked(chargeCredits).mockRejectedValueOnce(new InsufficientCreditsError(2, 0))
    const res = await POST(req(), ctx)
    expect(res.status).toBe(402)
  })
})
