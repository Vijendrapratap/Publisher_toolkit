import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook: vi.fn() }))
vi.mock('@/lib/credits/ledger', () => ({ ensureUser: vi.fn(async () => ({})) }))

import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { ensureUser } from '@/lib/credits/ledger'
import { POST } from './route'

const req = () => new Request('http://localhost/api/webhooks/clerk', { method: 'POST', body: '{}' })

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unverifiable payload', async () => {
    vi.mocked(verifyWebhook).mockRejectedValueOnce(new Error('bad signature'))
    expect((await POST(req() as never)).status).toBe(400)
    expect(ensureUser).not.toHaveBeenCalled()
  })

  it('creates the user with their primary email on user.created', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'user.created',
      data: {
        id: 'user_1',
        primary_email_address_id: 'e2',
        email_addresses: [{ id: 'e1', email_address: 'old@x.com' }, { id: 'e2', email_address: 'main@x.com' }],
      },
    } as never)
    expect((await POST(req() as never)).status).toBe(200)
    const [id, getEmail] = vi.mocked(ensureUser).mock.calls[0]
    expect(id).toBe('user_1')
    expect(await getEmail()).toBe('main@x.com')
  })

  it('ignores other event types', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({ type: 'user.updated', data: {} } as never)
    expect((await POST(req() as never)).status).toBe(200)
    expect(ensureUser).not.toHaveBeenCalled()
  })
})
