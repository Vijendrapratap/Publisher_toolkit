import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/audiobook/queries', () => ({ getAudiobookProjectForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    audiobookProject: { update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
    audiobookChapter: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { GET, PATCH, DELETE } from './route'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET/PATCH/DELETE /api/audiobook/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 404 for another publisher’s project', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })

  it('PATCH returns 404 for another publisher’s project', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce(null)
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }),
      ctx('proj_99')
    )
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 for another publisher’s project', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce(null)
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
