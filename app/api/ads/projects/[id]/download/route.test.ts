import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn(), getLatestCreativeSetForBook: vi.fn() }))
vi.mock('@/lib/services/ads/zip', () => ({
  buildCreativeZip: vi.fn().mockResolvedValue(Buffer.from('zip-bytes')),
  zipFileName: vi.fn().mockReturnValue('t-ad-creatives.zip'),
}))

import { GET } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/ads/projects/:id/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the zip as an attachment', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ images: [], adCopies: [] } as any)

    const res = await GET(new Request('http://localhost'), ctx('book_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="t-ad-creatives.zip"')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('zip-bytes')
  })

  it('returns 404 for a foreign book or when nothing is generated yet', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)

    vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)
  })
})
