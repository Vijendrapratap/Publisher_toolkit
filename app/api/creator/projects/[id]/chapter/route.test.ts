import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' } as never)).result) }
})
vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({
  getCreatorProjectForPublisher: vi.fn(),
  updateCreatorProject: vi.fn(),
}))
vi.mock('@/lib/services/creator/generator', () => ({ generateIndividualChapter: vi.fn() }))

import { POST } from './route'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (id: string) =>
  POST(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterNumber: 1 }),
    }),
    ctx(id)
  )

describe('POST /api/creator/projects/:id/chapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    expect((await post('proj_99')).status).toBe(404)
  })
})
