import { grantPurchase } from '@/lib/credits/ledger'
import { verifyWebhookSignature } from '@/lib/payments/razorpay'
import { orderCredits } from '@/lib/payments/orderCredits'

/**
 * Backstop for a buyer who paid but closed the tab before Checkout's callback
 * ran. Subscribe the dashboard webhook to `order.paid`. Safe to run alongside
 * /api/credits/verify: grantPurchase credits each order once.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature') ?? '')) {
    return Response.json({ error: 'bad signature' }, { status: 401 })
  }

  const event = JSON.parse(raw)
  if (event.event !== 'order.paid') return Response.json({ ok: true })

  const order = event.payload?.order?.entity
  const credit = order && orderCredits(order)
  if (!credit) {
    console.error('razorpay webhook: paid order does not match a credit pack', order?.id)
    return Response.json({ ok: true })
  }
  await grantPurchase(credit.userId, credit.credits, `razorpay:${order.id}`)
  return Response.json({ ok: true })
}
