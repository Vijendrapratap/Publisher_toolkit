import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/asset.mp4' }),
  readStoredFile: vi.fn().mockResolvedValue({ data: Buffer.from('fake-cover'), contentType: 'image/png' }),
}))
vi.mock('@/lib/services/trailer/queries', () => ({
  getTrailerProjectForPublisher: vi.fn(),
}))
vi.mock('@/lib/services/trailer/video', () => ({
  renderTrailerVideoAndPoster: vi.fn().mockResolvedValue({
    videoBuffer: Buffer.from('mp4-bytes'),
    posterBuffer: Buffer.from('png-bytes'),
    durationSec: 30,
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    generatedTrailer: { deleteMany: vi.fn() },
    trailerProject: { update: vi.fn() },
  },
}))

import { POST } from './route'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { renderTrailerVideoAndPoster } from '@/lib/services/trailer/video'
import { prisma } from '@/lib/db'

describe('POST /api/trailer/projects/[id]/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generates trailers and saves them in the database', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'Echoes of Eternity',
      author: 'Author One',
      blurb: 'A great blurb',
      length: '30s',
      style: 'cinematic',
      musicMood: 'suspenseful',
      aspectRatios: ['9:16', '16:9'],
      frontCoverUrl: 'https://blob.example/cover.png',
    } as any)

    const res = await POST(
      new Request('http://localhost/api/trailer/projects/proj_1/generate', { method: 'POST' }),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)

    expect(renderTrailerVideoAndPoster).toHaveBeenCalledTimes(2)
    expect(prisma.generatedTrailer.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'proj_1' },
    })
    expect(prisma.trailerProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj_1' },
        data: expect.objectContaining({
          status: 'generated',
        }),
      })
    )
  })

  it('returns 404 when project does not exist', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce(null)

    const res = await POST(
      new Request('http://localhost/api/trailer/projects/proj_99/generate', { method: 'POST' }),
      { params: Promise.resolve({ id: 'proj_99' }) }
    )

    expect(res.status).toBe(404)
  })
})
