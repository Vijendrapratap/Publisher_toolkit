import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))

vi.mock('@/lib/services/landing/queries', () => ({
  getLandingProjectForPublisher: vi.fn(),
}))

import { GET } from './route'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'

describe('GET /api/landing/projects/[id]/html', () => {
  beforeEach(() => vi.clearAllMocks())

  it('downloads standalone index.html for the landing project', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce({
      id: 'proj_1',
      publisherId: 'pub_1',
      title: 'The Silent Horizon',
      author: 'Aria Vance',
      template: 'bestseller',
      theme: 'matt',
      accentColor: '#38bdf8',
      ctaText: 'Get Your Copy',
    } as any)

    const res = await GET(new Request('http://localhost/api/landing/projects/proj_1/html'), {
      params: Promise.resolve({ id: 'proj_1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename=')
    const text = await res.text()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('The Silent Horizon')
    expect(text).toContain('Aria Vance')
  })

  it('returns 404 when project does not exist', async () => {
    vi.mocked(getLandingProjectForPublisher).mockResolvedValueOnce(null)

    const res = await GET(new Request('http://localhost/api/landing/projects/missing/html'), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(res.status).toBe(404)
  })
})
