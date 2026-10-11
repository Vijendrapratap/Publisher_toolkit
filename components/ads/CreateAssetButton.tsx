'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ASSET_LABELS, type AssetKind } from '@/lib/services/ads/projectAssets'

/** Starts one creation for the book, then hands off to its settings page. */
export function CreateAssetButton({ rootId, kind, label }: { rootId: string; kind: AssetKind; label: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onClick() {
    setPending(true)
    const res = await fetch('/api/ads/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ existingBookId: rootId, contentGoal: kind, campaignName: ASSET_LABELS[kind] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      toast.error(json.error ?? 'We couldn’t start that. Please try again.')
      return
    }
    router.push(`/ads/${json.id}/configure`)
  }

  return (
    <Button size="sm" loading={pending} onClick={onClick}>
      {label}
    </Button>
  )
}
