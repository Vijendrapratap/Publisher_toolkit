import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance, grantPurchase } from '@/lib/credits/ledger'
import { fetchOrder, verifyPaymentSignature } from '@/lib/payments/razorpay'
import { orderCredits } from '@/lib/payments/orderCredits'

/**
 * Checkout's success callback. The signature proves Razorpay took the payment
 * for this order; the amount and owner come from Razorpay's copy of the order,
 * never from the browser. Assumes auto-capture (the Razorpay default).
 */
export async function POST(request: Request) {
  const userId = await requireCurrentPublisherId()
  const body = await request.json().catch(() => ({}))
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    !verifyPaymentSignature(orderId, paymentId, signature)
  ) {
    return Response.json({ error: 'Payment could not be verified.' }, { status: 400 })
  }

  const credit = orderCredits(await fetchOrder(orderId))
  if (!credit) return Response.json({ error: 'Payment does not match a credit pack.' }, { status: 400 })
  if (credit.userId !== userId) return Response.json({ error: 'This payment belongs to another account.' }, { status: 403 })

  await grantPurchase(credit.userId, credit.credits, `razorpay:${orderId}`)
  return Response.json({ credited: credit.credits, balance: await getBalance(userId) })
}
