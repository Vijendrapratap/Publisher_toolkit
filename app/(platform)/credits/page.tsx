import type { Metadata } from 'next'
import { Coins } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBalance } from '@/lib/credits/ledger'
import { isRazorpayConfigured } from '@/lib/payments/razorpay'
import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { BuyCredits } from '@/components/platform/BuyCredits'

export const metadata: Metadata = { title: 'Credits & billing' }

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Account</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Credits & billing</h1>
      </header>

      <Card className="flex items-center gap-4 p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent shadow-subtle">
          <Coins className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm text-ink-muted">Current balance</p>
          <p className="font-display text-4xl font-semibold tabular-nums">
            {balance} <span className="text-base font-normal text-ink-muted">credits</span>
          </p>
        </div>
      </Card>

      <BuyCredits enabled={isRazorpayConfigured()} />

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-xl font-semibold">History</h2>
        <Card className="mt-4 overflow-x-auto p-2 sm:p-4">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-muted">
              <tr><th className="px-2 py-2">Date</th><th className="px-2">What</th><th className="px-2">Action</th><th className="px-2 text-right">Credits</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-2 py-2">{r.createdAt.toLocaleDateString()}</td>
                  <td className="px-2">{LABELS[r.kind] ?? r.kind}</td>
                  <td className="px-2 text-ink-muted">{r.kind === 'purchase' ? 'Razorpay' : r.action ?? ''}</td>
                  <td className="px-2 text-right tabular-nums">{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}
