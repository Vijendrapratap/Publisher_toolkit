import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/credits/ledger', () => ({ grantPurchase: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/payments/razorpay', () => ({ verifyWebhookSignature: vi.fn() }))

import { POST } from './route'
import { grantPurchase } from '@/lib/credits/ledger'
import { verifyWebhookSignature } from '@/lib/payments/razorpay'

const paid = {
  event: 'order.paid',
  payload: { order: { entity: { id: 'order_9', amount: 399_900, amount_paid: 399_900, currency: 'INR', status: 'paid', notes: { userId: 'pub_1', pack: 'pro' } } } },
}
const req = (body: unknown) =>
  new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'sig' },
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/webhooks/razorpay', () => {
  it('credits a paid order even if the buyer closed the tab before the callback', async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true)
    const res = await POST(req(paid))
    expect(res.status).toBe(200)
    expect(grantPurchase).toHaveBeenCalledWith('pub_1', 500, 'razorpay:order_9')
  })

  it('rejects an unsigned webhook', async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(false)
    const res = await POST(req(paid))
    expect(res.status).toBe(401)
    expect(grantPurchase).not.toHaveBeenCalled()
  })

  it('acknowledges other events without crediting', async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(true)
    const res = await POST(req({ event: 'payment.failed', payload: {} }))
    expect(res.status).toBe(200)
    expect(grantPurchase).not.toHaveBeenCalled()
  })
})
