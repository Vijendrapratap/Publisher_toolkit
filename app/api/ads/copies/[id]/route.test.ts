import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getAdCopyForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { adCopy: { update: vi.fn() } } }))

import { PATCH } from './route'
import { getAdCopyForPublisher } from '@/lib/services/ads/queries'
import { prisma } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body: unknown) =>
  new Request('http://localhost/api/ads/copies/copy_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const edit = { headline: 'New headline', primaryText: 'New text', description: 'New desc' }

describe('PATCH /api/ads/copies/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves edited copy for the owner', async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue({ id: 'copy_1' } as any)
    vi.mocked(prisma.adCopy.update).mockResolvedValue({ id: 'copy_1', ...edit } as any)

    const res = await PATCH(req(edit), ctx('copy_1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'copy_1', ...edit })
    expect(prisma.adCopy.update).toHaveBeenCalledWith({ where: { id: 'copy_1' }, data: edit })
  })

  it("returns 404 for someone else's copy", async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue(null)
    expect((await PATCH(req(edit), ctx('copy_1'))).status).toBe(404)
    expect(prisma.adCopy.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid body', async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue({ id: 'copy_1' } as any)
    expect((await PATCH(req({ headline: 'x'.repeat(151), primaryText: '', description: '' }), ctx('copy_1'))).status).toBe(400)
  })
})
