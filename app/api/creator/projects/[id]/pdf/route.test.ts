import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({ getCreatorProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/creator/pdf', () => ({ generateBookPdf: vi.fn() }))

import { GET } from './route'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/creator/projects/:id/pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
