import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/credits/ledger', () => ({ grantPurchase: vi.fn().mockResolvedValue(true), getBalance: vi.fn().mockResolvedValue(120) }))
vi.mock('@/lib/payments/razorpay', () => ({
  verifyPaymentSignature: vi.fn().mockReturnValue(true),
  fetchOrder: vi.fn(),
}))

import { POST } from './route'
import { grantPurchase } from '@/lib/credits/ledger'
import { fetchOrder, verifyPaymentSignature } from '@/lib/payments/razorpay'

const order = (notes: Record<string, string>, amount = 89_900) =>
  ({ id: 'order_1', amount, amount_paid: amount, currency: 'INR', status: 'paid', notes }) as const
const req = () =>
  new Request('http://localhost/api/credits/verify', {
    method: 'POST',
    body: JSON.stringify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' }),
  })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/credits/verify', () => {
  it('credits the pack stored on the order once the signature checks out', async () => {
    vi.mocked(verifyPaymentSignature).mockReturnValue(true)
    vi.mocked(fetchOrder).mockResolvedValue(order({ userId: 'pub_1', pack: 'starter' }) as never)
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ credited: 100, balance: 120 })
    expect(grantPurchase).toHaveBeenCalledWith('pub_1', 100, 'razorpay:order_1')
  })

  it('rejects a forged signature without touching the ledger', async () => {
    vi.mocked(verifyPaymentSignature).mockReturnValue(false)
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(grantPurchase).not.toHaveBeenCalled()
  })

  it('refuses an order that belongs to another user', async () => {
    vi.mocked(verifyPaymentSignature).mockReturnValue(true)
    vi.mocked(fetchOrder).mockResolvedValue(order({ userId: 'pub_2', pack: 'starter' }) as never)
    const res = await POST(req())
    expect(res.status).toBe(403)
    expect(grantPurchase).not.toHaveBeenCalled()
  })

  it('refuses an order whose amount does not match its pack', async () => {
    vi.mocked(verifyPaymentSignature).mockReturnValue(true)
    vi.mocked(fetchOrder).mockResolvedValue(order({ userId: 'pub_1', pack: 'studio' }, 100) as never)
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(grantPurchase).not.toHaveBeenCalled()
  })
})
