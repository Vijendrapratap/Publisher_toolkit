import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance } from '@/lib/credits/ledger'
import { prisma } from '@/lib/db'

const LABELS: Record<string, string> = {
  signup_grant: 'Welcome credits',
  purchase: 'Purchase',
  reserve: 'Used',
  refund: 'Refund',
  adjust: 'Adjustment',
}

export default async function CreditsPage() {
  const userId = await requireCurrentPublisherId()
  const [balance, rows] = await Promise.all([
    getBalance(userId),
    prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Credits</h1>
      <p className="mt-2 text-ink-muted">
        You have <strong className="text-ink">{balance}</strong> credits. Buying more is coming soon.
      </p>
      <table className="mt-8 w-full text-sm">
        <thead className="text-left text-ink-muted">
          <tr><th className="py-2">Date</th><th>What</th><th>Action</th><th className="text-right">Credits</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="py-2">{r.createdAt.toLocaleDateString()}</td>
              <td>{LABELS[r.kind] ?? r.kind}</td>
              <td className="text-ink-muted">{r.action ?? ''}</td>
              <td className="text-right tabular-nums">{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
