import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    creativeImage: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/providers/storage', () => ({
  readStoredFile: vi.fn(),
}))

import { GET } from './route'
import { prisma } from '@/lib/db'
import { readStoredFile } from '@/lib/providers/storage'

describe('GET /api/creatives/[id]/image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when image record not found', async () => {
    vi.mocked(prisma.creativeImage.findUnique).mockResolvedValue(null)
    const req = new Request('http://localhost/api/creatives/img_1/image')
    const res = await GET(req, { params: Promise.resolve({ id: 'img_1' }) })
    expect(res.status).toBe(404)
  })

  it('serves image buffer with content-type', async () => {
    vi.mocked(prisma.creativeImage.findUnique).mockResolvedValue({
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
    vi.mocked(prisma.creativeImage.findUnique).mockResolvedValue({
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
