import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/services/trailer/queries', () => ({
  getTrailerProjectForPublisher: vi.fn(),
}))
vi.mock('@/lib/services/trailer/zip', () => ({
  buildTrailerZip: vi.fn().mockResolvedValue(Buffer.from('zip-binary-data')),
  zipFileName: vi.fn().mockReturnValue('test-book-trailer-videos.zip'),
}))

import { GET } from './route'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { buildTrailerZip } from '@/lib/services/trailer/zip'

describe('GET /api/trailer/projects/[id]/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a zip download response with attachment header', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'Test Book',
      trailers: [
        {
          id: 't_1',
          aspectRatio: '9:16',
          videoUrl: 'https://blob.example/v.mp4',
          posterUrl: 'https://blob.example/p.png',
        },
      ],
    } as any)

    const res = await GET(
      new Request('http://localhost/api/trailer/projects/proj_1/download'),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="test-book-trailer-videos.zip"')
    expect(buildTrailerZip).toHaveBeenCalled()
  })

  it('returns 404 when project has no trailers generated', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'Test Book',
      trailers: [],
    } as any)

    const res = await GET(
      new Request('http://localhost/api/trailer/projects/proj_1/download'),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(404)
  })
})
