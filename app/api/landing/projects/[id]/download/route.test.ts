import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/landing/queries', () => ({ getLandingProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/landing/zip', () => ({
  buildLandingZip: vi.fn().mockResolvedValue(Buffer.from('zip')),
  landingZipFileName: vi.fn().mockReturnValue('site.zip'),
}))

import { GET } from './route'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/landing/projects/:id/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
