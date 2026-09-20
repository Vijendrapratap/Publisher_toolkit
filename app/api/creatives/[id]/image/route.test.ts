import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    creativeImage: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/providers/storage', () => ({
  readStoredFile: vi.fn(),
}))

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))

import { GET } from './route'
import { prisma } from '@/lib/db'
import { readStoredFile } from '@/lib/providers/storage'

describe('GET /api/creatives/[id]/image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the lookup to the signed-in publisher', async () => {
    vi.mocked(prisma.creativeImage.findFirst).mockResolvedValue(null)
    const req = new Request('http://localhost/api/creatives/img_1/image')
    await GET(req, { params: Promise.resolve({ id: 'img_1' }) })

    expect(prisma.creativeImage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'img_1', creativeSet: { book: { publisherId: 'pub_1' } } },
      })
    )
  })

  it('returns 404 when the image is not found or not theirs', async () => {
    vi.mocked(prisma.creativeImage.findFirst).mockResolvedValue(null)
    const req = new Request('http://localhost/api/creatives/img_1/image')
    const res = await GET(req, { params: Promise.resolve({ id: 'img_1' }) })
    expect(res.status).toBe(404)
  })

  it('serves image buffer with content-type', async () => {
    vi.mocked(prisma.creativeImage.findFirst).mockResolvedValue({
      imageUrl: '/api/files/ads/pub_1/img.png',
      sizeKey: 'google_display_300x250',
      platform: 'GOOGLE',
    } as any)
    vi.mocked(readStoredFile).mockResolvedValue({
      data: Buffer.from('fake-png-bytes'),
      contentType: 'image/png',
    })

    const req = new Request('http://localhost/api/creatives/img_1/image')
    const res = await GET(req, { params: Promise.resolve({ id: 'img_1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
  })

  it('adds attachment content-disposition when download=1', async () => {
    vi.mocked(prisma.creativeImage.findFirst).mockResolvedValue({
      imageUrl: '/api/files/ads/pub_1/img.png',
      sizeKey: 'google_display_300x250',
      platform: 'GOOGLE',
    } as any)
    vi.mocked(readStoredFile).mockResolvedValue({
      data: Buffer.from('fake-png-bytes'),
      contentType: 'image/png',
    })

    const req = new Request('http://localhost/api/creatives/img_1/image?download=1')
    const res = await GET(req, { params: Promise.resolve({ id: 'img_1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="google_display_300x250.png"')
  })
})
