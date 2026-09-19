import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))

vi.mock('@/lib/services/landing/queries', () => ({
  getLandingProjectForPublisher: vi.fn(),
}))

vi.mock('@/lib/services/landing/agent', () => ({
  runAuthorLandingAgent: vi.fn().mockResolvedValue({
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
import { prisma } from '@/lib/db'

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
})
