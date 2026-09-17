import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/new-front.png' }),
}))
vi.mock('@/lib/services/trailer/queries', () => ({
  getTrailerProjectForPublisher: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    trailerProject: {
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'proj_1', ...data })),
    },
  },
}))

import { PATCH } from './route'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { prisma } from '@/lib/db'

describe('PATCH /api/trailer/projects/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 if the project is not found for the publisher', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce(null)

    const res = await PATCH(
      new Request('http://localhost/api/trailer/projects/proj_99', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      }),
      { params: Promise.resolve({ id: 'proj_99' }) }
    )

    expect(res.status).toBe(404)
  })

  it('updates project configuration and sets status to configured when complete', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      status: 'uploaded',
    } as any)

    const res = await PATCH(
      new Request('http://localhost/api/trailer/projects/proj_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Configured Title',
          length: '30s',
          style: 'cinematic',
          musicMood: 'epic',
          aspectRatios: ['9:16', '16:9'],
        }),
      }),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(200)
    expect(prisma.trailerProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj_1' },
        data: expect.objectContaining({
          title: 'Configured Title',
          length: '30s',
          style: 'cinematic',
          musicMood: 'epic',
          status: 'configured',
        }),
      })
    )
  })

  it('updates covers when uploaded via FormData', async () => {
    vi.mocked(getTrailerProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
    } as any)

    const form = new FormData()
    form.append('frontCover', new Blob([Buffer.from('front-cover-data')], { type: 'image/png' }))

    const res = await PATCH(
      new Request('http://localhost/api/trailer/projects/proj_1', { method: 'PATCH', body: form }),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(200)
    expect(prisma.trailerProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj_1' },
        data: expect.objectContaining({
          frontCoverUrl: 'https://blob.example/new-front.png',
        }),
      })
    )
  })
})
