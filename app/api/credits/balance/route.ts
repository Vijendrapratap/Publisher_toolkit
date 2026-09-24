import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance } from '@/lib/credits/ledger'

export async function GET() {
  const userId = await requireCurrentPublisherId()
  return Response.json({ balance: await getBalance(userId) }, { headers: { 'Cache-Control': 'no-store' } })
}
