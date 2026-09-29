import { getPack, PACK_CURRENCY } from '@/lib/credits/packs'
import type { RazorpayOrder } from './razorpay'

/**
 * Who a Razorpay order credits and how much, read from the notes our checkout
 * route wrote when it created the order. Null if the order doesn't match its
 * pack (wrong amount/currency, unknown pack) — never credit those.
 */
export function orderCredits(order: Pick<RazorpayOrder, 'amount' | 'currency' | 'notes'>) {
  const pack = getPack(order.notes?.pack)
  const userId = order.notes?.userId
  if (!pack || !userId || order.amount !== pack.amount || order.currency !== PACK_CURRENCY) return null
  return { userId, credits: pack.credits }
}
