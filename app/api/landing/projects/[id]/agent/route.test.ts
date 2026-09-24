import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' } as never)).result) }
})

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))

vi.mock('@/lib/services/landing/queries', () => ({
  getLandingProjectForPublisher: vi.fn(),
}))

vi.mock('@/lib/services/landing/agent', () => ({
  runAuthorLandingAgent: vi.fn().mockResolvedValue({
    source: 'ai',
    data: {
    headline: 'New Masterpiece by Elena Rostova',
    subtitle: 'A thrilling mystery in the heart of winter',
    authorBio: 'Elena Rostova is an acclaimed mystery writer.',
    authorQuote: 'Secrets are written on ice.',
    synopsis: 'A gripping tale of suspense.',
    ctaText: 'Order Your Copy Today',
    newsletterHeading: 'Join Elena’s Inner Circle',
    newsletterIncentive: 'Free bonus chapter',
    recommendedTemplate: 'editorial',
    recommendedTheme: 'matt',
    recommendedAccent: '#f59e0b',
    reviews: [{ quote: 'Brilliant!', reviewer: 'Critic', outlet: 'Press' }],
    },
  }),
  authorLandingAgentInputSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: {
        bookTitle: 'Winter’s Ghost',
        authorName: 'Elena Rostova',
        primaryObjective: 'preorder',
      },
    }),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    landingProject: {
      update: vi.fn().mockResolvedValue({
        id: 'proj_1',
        title: 'Winter’s Ghost',
        author: 'Elena Rostova',
        template: 'editorial',
      }),
    },
  },
}))

import { POST } from './route'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { runAuthorLandingAgent } from '@/lib/services/landing/agent'
import { prisma } from '@/lib/db'
import { chargeCredits } from '@/lib/credits/charge'
import { InsufficientCreditsError } from '@/lib/credits/ledger'

describe('POST /api/landing/projects/[id]/agent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the DeepSeek v4.1 author landing agent and updates project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'Winter’s Ghost',
      author: 'Elena Rostova',
    } as any)

    const res = await POST(
      new Request('http://localhost/api/landing/projects/proj_1/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryObjective: 'preorder' }),
      }),
      { params: Promise.resolve({ id: 'proj_1' }) }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.agentResult.headline).toContain('Elena Rostova')
    expect(prisma.landingProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj_1' },
      })
    )
  })

  it('returns 404 if project is missing', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)

    const res = await POST(
      new Request('http://localhost/api/landing/projects/missing/agent', { method: 'POST' }),
      { params: Promise.resolve({ id: 'missing' }) }
    )

    expect(res.status).toBe(404)
  })

  const request = () =>
    new Request('http://localhost/api/landing/projects/proj_1/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryObjective: 'preorder' }),
    })
  const ctx = { params: Promise.resolve({ id: 'proj_1' }) }

  it('charges for generating the landing copy', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'Winter’s Ghost',
      author: 'Elena Rostova',
    } as any)

    await POST(request(), ctx)

    expect(chargeCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pub_1', action: 'landing.agent', refId: 'proj_1' }),
      expect.any(Function)
    )
  })

  it('returns 402 when the user cannot afford it', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce({ id: 'proj_1', publisherId: 'pub_1' } as any)
    vi.mocked(chargeCredits).mockRejectedValueOnce(new InsufficientCreditsError(2, 0))

    const res = await POST(request(), ctx)
    expect(res.status).toBe(402)
  })

  it('does not charge for fallback copy', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce({ id: 'proj_1', publisherId: 'pub_1' } as any)
    vi.mocked(runAuthorLandingAgent).mockResolvedValueOnce({
      data: {
        subtitle: 'S',
        authorBio: 'B',
        synopsis: 'Y',
        ctaText: 'C',
        newsletterHeading: 'N',
        newsletterIncentive: 'I',
        recommendedTemplate: 'editorial',
        recommendedTheme: 'matt',
        recommendedAccent: '#000',
        reviews: [],
      } as any,
      source: 'fallback',
      reason: 'timeout',
    })
    let reported: { usedUnits?: number } | undefined
    vi.mocked(chargeCredits).mockImplementationOnce(async (_i, fn) => {
      const out = await fn({ key: 'k' } as never)
      reported = out
      return out.result
    })

    await POST(request(), ctx)

    expect(reported?.usedUnits).toBe(0)
  })
})
