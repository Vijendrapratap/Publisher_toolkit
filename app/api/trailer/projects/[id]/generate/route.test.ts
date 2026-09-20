import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/publisher/settings', () => ({
  getPublisherAiCredentials: vi.fn().mockResolvedValue({ apiKey: null, model: null }),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/asset' }),
  readStoredFile: vi.fn().mockResolvedValue({ data: Buffer.from('fake-cover'), contentType: 'image/png' }),
}))
vi.mock('@/lib/services/trailer/queries', () => ({
  getTrailerProjectForPublisher: vi.fn(),
}))
vi.mock('@/lib/services/videoad/render', () => ({
  VideoAdRenderError: class VideoAdRenderError extends Error {},
  renderVideoAd: vi.fn().mockResolvedValue({
    videoBuffer: Buffer.from('mp4-bytes'),
    posterBuffer: Buffer.from('png-bytes'),
    durationSec: 15,
    width: 1080,
    height: 1080,
    format: '1:1',
    beats: [],
  }),
}))
vi.mock('@/lib/services/videoad/copy', () => ({
  generateAdScript: vi.fn(),
  generateAdScene: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    generatedTrailer: { deleteMany: vi.fn() },
    trailerProject: { update: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}))

import { POST } from './route'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { renderVideoAd, VideoAdRenderError } from '@/lib/services/videoad/render'
import { generateAdScript, generateAdScene } from '@/lib/services/videoad/copy'
import { prisma } from '@/lib/db'

const project = {
  id: 'proj_1',
  publisherId: 'pub_1',
  title: '2027 Spring Large Print Word Search',
  author: 'April Rally',
  blurb: 'A seasonal puzzle book.',
  frontCoverUrl: 'https://blob.example/cover.png',
  interiorImageUrls: [],
  aspectRatios: ['1:1', '16:9'],
  length: '15s',
  adPreset: 'puzzle',
  adHeadline: null,
  adBenefits: [],
  ctaText: null,
  aiScene: false,
  showProof: true,
  rating: 5,
  reviewCount: 12,
  price: '$13.99',
  categories: ['Word Search Puzzles'],
  bullets: ['2,000 words with solutions'],
}

const script = {
  source: 'ai' as const,
  data: { headline: '2,000 WORDS', benefits: ['EXTRA LARGE PRINT'], ctaText: 'GET YOUR COPY' },
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (id = 'proj_1') =>
  POST(new Request(`http://localhost/api/trailer/projects/${id}/generate`, { method: 'POST' }), ctx(id))

describe('POST /api/trailer/projects/[id]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValue(project as never)
    vi.mocked(generateAdScript).mockResolvedValue(script as never)
  })

  it('renders one ad per requested format and stores them atomically', async () => {
    const res = await post()

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ success: true, count: 2 })
    expect(renderVideoAd).toHaveBeenCalledTimes(2)

    // Clearing the old cuts and writing the new ones must be one transaction,
    // or a failure between them leaves the project with no ads at all.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.trailerProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'generated', adHeadline: '2,000 WORDS' }),
      })
    )
  })

  it('passes the generated script and the listing proof into every cut', async () => {
    await post()

    expect(renderVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: '2,000 WORDS',
        benefits: ['EXTRA LARGE PRINT'],
        preset: 'puzzle',
        rating: 5,
        price: '$13.99',
      })
    )
  })

  it('reuses an edited script instead of regenerating over the publisher', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValue({
      ...project,
      adHeadline: 'MY OWN HEADLINE',
      adBenefits: ['HAND WRITTEN'],
    } as never)

    await post()

    expect(generateAdScript).not.toHaveBeenCalled()
    expect(renderVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({ headline: 'MY OWN HEADLINE', benefits: ['HAND WRITTEN'] })
    )
  })

  it('withholds the proof beat when the publisher turned it off', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValue({ ...project, showProof: false } as never)

    await post()

    expect(renderVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({ rating: null, reviewCount: null, price: null })
    )
  })

  it('warns, rather than silently shipping sample copy, when AI was unavailable', async () => {
    vi.mocked(generateAdScript).mockResolvedValue({ ...script, source: 'fallback' } as never)

    expect((await (await post()).json()).warning).toMatch(/placeholder/i)
  })

  it('falls back to the designed template when the AI scene fails', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValue({ ...project, aiScene: true } as never)
    vi.mocked(generateAdScene).mockResolvedValue(null)

    const body = await (await post()).json()
    expect(body.success).toBe(true)
    expect(body.warning).toMatch(/background/i)
  })

  it('reports why rendering failed instead of storing an unplayable file', async () => {
    vi.mocked(renderVideoAd).mockRejectedValue(
      new VideoAdRenderError('ffmpeg is not installed on this server, so video cannot be rendered.')
    )

    const res = await post()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('ffmpeg is not installed')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 when the project does not exist', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValue(null)
    expect((await post('proj_99')).status).toBe(404)
  })
})
