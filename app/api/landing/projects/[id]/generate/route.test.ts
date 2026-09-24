import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/landing/queries', () => ({ getLandingProjectForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: { landingProject: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) } },
}))

import { POST } from './route'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('POST /api/landing/projects/:id/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost', { method: 'POST' }), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
