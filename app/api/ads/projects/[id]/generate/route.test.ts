import { describe, it, expect, vi, beforeEach } from 'vitest'

const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/api/files/ads/pub_1/cover.png',
  platforms: ['META'], copyTone: 'punchy', templateKey: 'bold',
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/publisher/settings', () => ({
  getPublisherAiCredentials: vi.fn().mockResolvedValue({ apiKey: null, model: null }),
}))
vi.mock('@/lib/services/ads/copy', () => ({ generateAdCopy: vi.fn() }))
vi.mock('@/lib/services/ads/render', () => ({ renderCreativeImages: vi.fn() }))
vi.mock('@/lib/services/trailer/video', () => ({
  renderTrailerVideoAndPoster: vi.fn().mockResolvedValue({
    videoBuffer: Buffer.from('video'),
    posterBuffer: Buffer.from('poster'),
    durationSec: 15,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
  }),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: '/api/files/ads/pub_1/creatives/x/meta_feed_1080x1080.png' }),
  readStoredFile: vi.fn().mockResolvedValue({ data: Buffer.from('cover'), contentType: 'image/png' }),
  toDataUri: vi.fn().mockReturnValue('data:image/png;base64,Y292ZXI='),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    book: { update: vi.fn().mockResolvedValue({}) },
  },
}))

import { POST } from './route'
import { generateAdCopy } from '@/lib/services/ads/copy'
import { renderCreativeImages } from '@/lib/services/ads/render'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { prisma } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const metaImage = { sizeKey: 'meta_feed_1080x1080', platform: 'META' as const, width: 1080, height: 1080, pngBuffer: Buffer.from('png') }

describe('POST /api/ads/projects/:id/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(renderCreativeImages).mockResolvedValue([metaImage])
  })

  it('generates with the saved configuration and marks the project generated', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue({ source: 'ai', data: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] })

    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(typeof json.creativeSetId).toBe('string')
    expect(json.creativeSetId.length).toBeGreaterThan(0)
    expect(generateAdCopy).toHaveBeenCalledWith(
      { title: 'T', author: 'A', blurb: 'B' },
      expect.objectContaining({ tone: 'punchy', platforms: ['META'] })
    )
    expect(renderCreativeImages).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageUrl: 'data:image/png;base64,Y292ZXI=', templateKey: 'bold', platforms: ['META'] })
    )
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: expect.objectContaining({
        status: 'generated',
        creativeSets: {
          create: expect.objectContaining({
            adCopies: { createMany: { data: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
          }),
        },
      }),
    })
  })

  it('writes a blank, editable copy row per platform when copy generation fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue({ source: 'ai', data: [] })
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(201)
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: expect.objectContaining({
        status: 'generated',
        creativeSets: {
          create: expect.objectContaining({
            adCopies: { createMany: { data: [{ platform: 'META', headline: '', primaryText: '', description: '' }] } },
          }),
        },
      }),
    })
  })

  it('returns a readable 500 and writes nothing when image rendering fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue({ source: 'ai', data: [] })
    vi.mocked(renderCreativeImages).mockRejectedValue(new Error('satori exploded'))
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/couldn.t generate/i)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('returns a readable 500 and no partial state when the atomic write fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue({ source: 'ai', data: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] })
    vi.mocked(prisma.book.update).mockRejectedValue(new Error('db exploded'))
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/couldn.t generate/i)
  })

  it('returns 404 when the book does not belong to the caller', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)
  })

  it('returns 400 when the book has no cover image', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce({ ...book, frontCoverUrl: null } as any)
    expect((await POST(new Request('http://localhost'), ctx('book_1'))).status).toBe(400)
  })
})
