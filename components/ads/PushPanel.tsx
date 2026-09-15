'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, FlaskConical, Send, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AdPlatform } from '@/lib/services/ads/copy'
import type { PushReceipt } from '@/lib/providers/adsPush'

const PUSHABLE = [
  { key: 'META', label: 'Meta Ads' },
  { key: 'GOOGLE', label: 'Google Ads' },
] as const

export function PushPanel({ projectId, platforms, simulated }: { projectId: string; platforms: AdPlatform[]; simulated: boolean }) {
  const [pending, setPending] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Record<string, PushReceipt>>({})
  const available = PUSHABLE.filter((p) => platforms.includes(p.key))

  async function push(platform: (typeof PUSHABLE)[number]) {
    setPending(platform.key)
    const res = await fetch(`/api/ads/projects/${projectId}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform.key }),
    })
    setPending(null)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error ?? `Couldn’t push to ${platform.label}.`)
      return
    }
    setReceipts((r) => ({ ...r, [platform.key]: json }))
    toast.success(`Sent to ${platform.label}`, { description: json.campaignName })
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Launch a campaign</h2>
          <p className="text-sm text-ink-muted">Send these creatives straight to your ad account.</p>
        </div>
        {simulated && (
          <Badge tone="warning" title="Ad account connections are simulated while running locally.">
            <FlaskConical className="size-3.5" aria-hidden /> Simulated
          </Badge>
        )}
      </div>

      {available.length === 0 && <p className="text-sm text-ink-muted">Select Meta or Google in Configure to push directly.</p>}

      <ul className="flex flex-col gap-3">
        {available.map((p) => {
          const receipt = receipts[p.key]
          return (
            <li key={p.key} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{p.label}</span>
                <Button size="sm" variant={receipt ? 'secondary' : 'primary'} loading={pending === p.key} onClick={() => push(p)}>
                  <Send className="size-4" aria-hidden /> {receipt ? 'Push again' : 'Connect & push'}
                </Button>
              </div>
              {receipt && (
                <p className="flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {receipt.campaignName}
                    <span className="block font-mono text-xs text-ink-muted">
                      Receipt {receipt.receiptId}{receipt.status === 'simulated' ? ' · simulated' : ''}
                    </span>
                  </span>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {platforms.includes('AMAZON') && (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted">
          <ShoppingBag className="mt-0.5 size-4 shrink-0" aria-hidden />
          Amazon doesn’t offer self-serve uploads from other tools. Download the ZIP and add the 300×250 creative in Amazon Ads.
        </p>
      )}
    </Card>
  )
}
