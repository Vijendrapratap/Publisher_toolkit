import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/books/queries', () => ({
  getBookForPublisher: vi.fn().mockResolvedValue({
    id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: 'https://x/cover.png',
  }),
}))
vi.mock('@/lib/ai/generateAdCopy', () => ({ generateAdCopy: vi.fn() }))
vi.mock('@/lib/compositing/renderCreativeImages', () => ({ renderCreativeImages: vi.fn() }))
vi.mock('@/lib/blob', () => ({ uploadToBlob: vi.fn().mockResolvedValue({ url: 'https://blob.example/img.png' }) }))
vi.mock('@/lib/db', () => ({
  prisma: {
    creativeSet: {
      create: vi.fn().mockResolvedValue({ id: 'set_1' }),
    },
  },
}))

import { POST } from './route'
import { generateAdCopy } from '@/lib/ai/generateAdCopy'
import { renderCreativeImages } from '@/lib/compositing/renderCreativeImages'
import { prisma } from '@/lib/db'
import { getBookForPublisher } from '@/lib/books/queries'

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/books/:id/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a creative set with copy and images on success', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([
      { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
    ])
    vi.mocked(renderCreativeImages).mockResolvedValue([
      { sizeKey: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080, pngBuffer: Buffer.from('png') },
    ])

    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.creativeSetId).toBe('set_1')
    expect(prisma.creativeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookId: 'book_1',
          adCopies: { createMany: { data: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
          images: {
            createMany: {
              data: [{ platform: 'META', sizeKey: 'meta_feed_1080x1080', width: 1080, height: 1080, imageUrl: 'https://blob.example/img.png' }],
            },
          },
        }),
      })
    )
  })

  it('still creates the creative set with no copy rows if copy generation fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([])
    vi.mocked(renderCreativeImages).mockResolvedValue([
      { sizeKey: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080, pngBuffer: Buffer.from('png') },
    ])

    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(201)
    expect(prisma.creativeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adCopies: { createMany: { data: [] } } }),
      })
    )
  })

  it('returns 404 when the book does not belong to the caller', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the book has no cover image', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce({
      id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: null,
    } as any)
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(400)
  })
})
