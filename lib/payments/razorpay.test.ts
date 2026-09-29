import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay'

const hmac = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex')

afterEach(() => vi.unstubAllEnvs())

describe('razorpay signatures', () => {
  it('accepts the checkout signature Razorpay computes over order|payment', () => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'secret')
    const sig = hmac('secret', 'order_1|pay_1')
    expect(verifyPaymentSignature('order_1', 'pay_1', sig)).toBe(true)
    expect(verifyPaymentSignature('order_2', 'pay_1', sig)).toBe(false)
    expect(verifyPaymentSignature('order_1', 'pay_1', 'nope')).toBe(false)
  })

  it('verifies webhooks against the raw body and the webhook secret', () => {
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'whsec')
    const body = '{"event":"order.paid"}'
    expect(verifyWebhookSignature(body, hmac('whsec', body))).toBe(true)
    expect(verifyWebhookSignature(body + ' ', hmac('whsec', body))).toBe(false)
  })

  it('refuses everything when the secret is not configured', () => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', '')
    expect(verifyPaymentSignature('order_1', 'pay_1', hmac('', 'order_1|pay_1'))).toBe(false)
  })
})
