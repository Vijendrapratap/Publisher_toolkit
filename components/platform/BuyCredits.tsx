'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { CREDIT_PACKS, formatInr } from '@/lib/credits/packs'

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type RazorpayCheckout = new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: () => void): void }

function loadCheckout(): Promise<RazorpayCheckout> {
  const w = window as unknown as { Razorpay?: RazorpayCheckout }
  if (w.Razorpay) return Promise.resolve(w.Razorpay)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay failed to load')))
    script.onerror = () => reject(new Error('Razorpay failed to load'))
    document.body.appendChild(script)
  })
}

export function BuyCredits({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function buy(packKey: string) {
    setPending(packKey)
    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packKey }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error ?? 'Couldn’t start the payment.')
      const Razorpay = await loadCheckout()

      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Publisher Toolkit',
        description: `${order.credits} credits`,
        theme: { color: '#2f4a8a' },
        modal: { ondismiss: () => setPending(null) },
        handler: async (payment: RazorpayResponse) => {
          const verify = await fetch('/api/credits/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment),
          })
          const result = await verify.json().catch(() => ({}))
          setPending(null)
          if (!verify.ok) {
            toast.error(result.error ?? 'We couldn’t confirm the payment. If you were charged, credits will arrive shortly.')
            return
          }
          toast.success(`${result.credited} credits added`)
          window.dispatchEvent(new Event('credits:changed'))
          router.refresh()
        },
      })
      checkout.on('payment.failed', () => {
        setPending(null)
        toast.error('Payment failed. You weren’t charged.')
      })
      checkout.open()
    } catch (err) {
      setPending(null)
      toast.error(err instanceof Error ? err.message : 'Couldn’t start the payment.')
    }
  }

  return (
    <section aria-labelledby="buy-heading" className="flex flex-col gap-4">
      <h2 id="buy-heading" className="font-display text-xl font-semibold">Add credits</h2>
      {!enabled && (
        <p role="status" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Payments aren’t set up yet — add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to enable buying.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <li key={pack.key}>
            <Card className={cn('flex h-full flex-col gap-3 p-5', pack.key === 'pro' && 'ring-2 ring-accent/40')}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-muted">{pack.label}</span>
                {'note' in pack && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{pack.note}</span>
                )}
              </div>
              <p className="flex items-baseline gap-1.5">
                <Coins className="size-4 self-center text-accent" aria-hidden />
                <span className="font-display text-3xl font-semibold tabular-nums">{pack.credits.toLocaleString('en-IN')}</span>
                <span className="text-sm text-ink-muted">credits</span>
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatInr(pack.amount)}</p>
              <Button
                className="mt-auto"
                variant={pack.key === 'pro' ? 'primary' : 'secondary'}
                loading={pending === pack.key}
                disabled={!enabled || pending !== null}
                onClick={() => buy(pack.key)}
              >
                Buy {pack.label}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted">Secure payment by Razorpay — UPI, cards, netbanking and wallets.</p>
    </section>
  )
}
