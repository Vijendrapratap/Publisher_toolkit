import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' } as never)).result) }
})

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/providers/ai', () => ({ isAiConfigured: vi.fn().mockReturnValue(true) }))
vi.mock('@/lib/services/creator/queries', () => ({
  getCreatorProjectForPublisher: vi.fn(),
  updateCreatorProject: vi.fn(),
}))
vi.mock('@/lib/services/creator/illustrate', () => ({
  illustrateProject: vi.fn(),
  countIllustrationRequests: vi.fn(),
}))

import { POST } from './route'
import { isAiConfigured } from '@/lib/providers/ai'
import { getCreatorProjectForPublisher, updateCreatorProject } from '@/lib/services/creator/queries'
import { illustrateProject, countIllustrationRequests } from '@/lib/services/creator/illustrate'
import { chargeCredits } from '@/lib/credits/charge'
import { InsufficientCreditsError } from '@/lib/credits/ledger'

const project = {
  id: 'proj_1',
  publisherId: 'pub_1',
  title: 'Barnaby Bear',
  styleTheme: 'watercolor',
  content: { type: 'children', pages: [{ pageNumber: 1, storyText: 'x', illustrationPrompt: 'x' }] },
  coverImageUrl: null,
  status: 'generated',
}

const illustrateResult = {
  content: project.content,
  coverImageUrl: '/api/files/cover.png',
  requested: 2,
  succeeded: 2,
  failures: [],
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (id = 'proj_1', body: unknown = {}) =>
  POST(
    new Request(`http://localhost/api/creator/projects/${id}/illustrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx(id)
  )

describe('POST /api/creator/projects/[id]/illustrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAiConfigured).mockReturnValue(true)
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValue(project as never)
    vi.mocked(countIllustrationRequests).mockReturnValue(2)
    vi.mocked(illustrateProject).mockResolvedValue(illustrateResult as never)
    vi.mocked(updateCreatorProject).mockResolvedValue({ ...project, coverImageUrl: illustrateResult.coverImageUrl } as never)
  })

  it('returns 404 when the project does not exist', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    expect((await post()).status).toBe(404)
  })

  it('returns 400 when the project has no content yet', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce({ ...project, content: null } as never)
    expect((await post()).status).toBe(400)
  })

  it('returns 400 when AI is not configured', async () => {
    vi.mocked(isAiConfigured).mockReturnValue(false)
    expect((await post()).status).toBe(400)
  })

  it('charges for the number of images the run will request', async () => {
    await post()
    expect(chargeCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pub_1', action: 'creator.illustrate', units: 2, refId: 'proj_1' }),
      expect.any(Function)
    )
  })

  it('returns 402 when the user cannot afford it', async () => {
    vi.mocked(chargeCredits).mockRejectedValueOnce(new InsufficientCreditsError(2, 0))
    const res = await post()
    expect(res.status).toBe(402)
  })

  it('settles usedUnits to the number that actually succeeded', async () => {
    vi.mocked(illustrateProject).mockResolvedValueOnce({ ...illustrateResult, succeeded: 1, failures: ['page-1: failed'] } as never)
    let reported: { usedUnits?: number } | undefined
    vi.mocked(chargeCredits).mockImplementationOnce(async (_i, fn) => {
      const out = await fn({ key: 'k' } as never)
      reported = out
      return out.result
    })

    const res = await post()

    expect(res.status).toBe(200)
    expect(reported?.usedUnits).toBe(1)
  })

  it('does not charge when there is nothing left to draw', async () => {
    vi.mocked(countIllustrationRequests).mockReturnValue(0)

    const res = await post()

    expect(res.status).toBe(200)
    expect(chargeCredits).not.toHaveBeenCalled()
    expect(illustrateProject).toHaveBeenCalled()
  })
})
