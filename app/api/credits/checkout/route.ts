import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPack, PACK_CURRENCY } from '@/lib/credits/packs'
import { createOrder, isRazorpayConfigured } from '@/lib/payments/razorpay'

/** Creates a Razorpay order for a credit pack; the browser opens Checkout with it. */
export async function POST(request: Request) {
  const userId = await requireCurrentPublisherId()
  if (!isRazorpayConfigured()) {
    return Response.json({ error: 'Payments aren’t set up yet.' }, { status: 503 })
  }
  const { pack: packKey } = await request.json().catch(() => ({}))
  const pack = getPack(packKey)
  if (!pack) return Response.json({ error: 'Unknown credit pack.' }, { status: 400 })

  try {
    const order = await createOrder({
      amount: pack.amount,
      currency: PACK_CURRENCY,
      receipt: `credits_${Date.now()}`,
      notes: { userId, pack: pack.key },
    })
    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      credits: pack.credits,
    })
  } catch (err) {
    console.error('razorpay order failed', err)
    return Response.json({ error: 'Couldn’t start the payment. Please try again.' }, { status: 502 })
  }
}
