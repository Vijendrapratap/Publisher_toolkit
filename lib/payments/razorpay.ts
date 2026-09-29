import { createHmac, timingSafeEqual } from 'node:crypto'

// Razorpay over its REST API — two calls and two HMACs don't need the SDK.
const API = 'https://api.razorpay.com/v1'

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export interface RazorpayOrder {
  id: string
  amount: number
  amount_paid: number
  currency: string
  status: 'created' | 'attempted' | 'paid'
  notes: Record<string, string>
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Razorpay ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export function createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
  return call<RazorpayOrder>('/orders', { method: 'POST', body: JSON.stringify(input) })
}

export function fetchOrder(orderId: string) {
  return call<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`)
}

function hmacMatches(secret: string | undefined, body: string, signature: string): boolean {
  if (!secret) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** The signature Checkout hands back: HMAC(key secret, "order_id|payment_id"). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  return hmacMatches(process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, signature)
}

/** X-Razorpay-Signature: HMAC(webhook secret, raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  return hmacMatches(process.env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature)
}
