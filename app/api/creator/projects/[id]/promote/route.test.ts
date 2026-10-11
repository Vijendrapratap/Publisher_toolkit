import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({ getCreatorProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/projects', () => ({ syncProjectFromCreator: vi.fn() }))

import { POST } from './route'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { syncProjectFromCreator } from '@/lib/services/ads/projects'

const call = () => POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'cp_1' }) })

describe('POST /api/creator/projects/[id]/promote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the book’s Ads project page', async () => {
    const project = { id: 'cp_1', title: 'Owl' }
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValue(project as never)
    vi.mocked(syncProjectFromCreator).mockResolvedValue({ id: 'root_1' } as never)

    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ projectUrl: '/ads/books/root_1' })
    expect(getCreatorProjectForPublisher).toHaveBeenCalledWith('pub_1', 'cp_1')
    expect(syncProjectFromCreator).toHaveBeenCalledWith('pub_1', project)
  })

  it('404s for a book the publisher does not own', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(404)
    expect(syncProjectFromCreator).not.toHaveBeenCalled()
  })
})
