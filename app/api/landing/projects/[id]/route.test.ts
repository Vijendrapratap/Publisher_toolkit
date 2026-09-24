import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/landing/queries', () => ({ getLandingProjectForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: { landingProject: { update: vi.fn(), delete: vi.fn() } },
}))

import { GET, PATCH, DELETE } from './route'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET/PATCH/DELETE /api/landing/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 404 for another publisher’s project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })

  it('PATCH returns 404 for another publisher’s project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)
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
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
