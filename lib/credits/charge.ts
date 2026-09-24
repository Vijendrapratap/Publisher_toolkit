import { NextResponse } from 'next/server'
import {
  InsufficientCreditsError,
  PlatformLimitError,
  refundReservation,
  reserveCredits,
  settleReservation,
  type Reservation,
} from './ledger'
import type { CreditAction } from './prices'

/**
 * The one way a route spends credits: reserve before the work, refund if it
 * throws, settle (fully or partly, via `usedUnits`) when it returns.
 * Return `usedUnits: 0` when the "result" is fallback/sample content.
 */
export async function chargeCredits<T>(
  input: { userId: string; action: CreditAction; units?: number; refId?: string; key?: string },
  fn: (reservation: Reservation) => Promise<{ result: T; usedUnits?: number; costUsd?: number }>
): Promise<T> {
  const reservation = await reserveCredits(input)
  let out: { result: T; usedUnits?: number; costUsd?: number }
  try {
    out = await fn(reservation)
  } catch (err) {
    try {
      await refundReservation(reservation.key)
    } catch (refundErr) {
      console.error('credit refund failed', reservation.key, refundErr)
    }
    throw err
  }
  await settleReservation(reservation.key, { usedUnits: out.usedUnits, costUsd: out.costUsd })
  return out.result
}

export function creditErrorResponse(err: unknown): Response | null {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json(
      { error: err.message, code: 'insufficient_credits', required: err.required, balance: err.balance },
      { status: 402 }
    )
  }
  if (err instanceof PlatformLimitError) {
    return NextResponse.json({ error: err.message, code: 'platform_limit' }, { status: 503 })
  }
  return null
}
