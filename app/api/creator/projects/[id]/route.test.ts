import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({
  getCreatorProjectForPublisher: vi.fn(),
  updateCreatorProject: vi.fn(),
  deleteCreatorProject: vi.fn(),
}))

import { GET, PATCH, DELETE } from './route'
import { getCreatorProjectForPublisher, updateCreatorProject, deleteCreatorProject } from '@/lib/services/creator/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET/PATCH/DELETE /api/creator/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 404 for another publisher’s project', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })

  it('PATCH returns 404 for another publisher’s project', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce(null)
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }),
      ctx('proj_99')
    )
    expect(res.status).toBe(404)
  })

  it('PATCH returns 404 when updateCreatorProject finds no owned row to update', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce({ id: 'proj_1' } as never)
    vi.mocked(updateCreatorProject).mockResolvedValueOnce(null)
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }),
      ctx('proj_1')
    )
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 for another publisher’s project', async () => {
    vi.mocked(deleteCreatorProject).mockResolvedValueOnce(false)
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
