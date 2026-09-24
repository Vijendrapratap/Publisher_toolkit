import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({ getCreatorProjectForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { book: { create: vi.fn() } } }))

import { POST } from './route'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('POST /api/creator/projects/:id/send-to-ads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost', { method: 'POST' }), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
