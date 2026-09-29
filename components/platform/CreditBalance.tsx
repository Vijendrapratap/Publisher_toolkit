'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Coins, Plus } from 'lucide-react'

export function CreditBalance() {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/credits/balance')
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setBalance(b.balance))
        .catch(() => {})
    load()
    window.addEventListener('credits:changed', load)
    window.addEventListener('focus', load)
    return () => {
      window.removeEventListener('credits:changed', load)
      window.removeEventListener('focus', load)
    }
  }, [])

  return (
    <Link
      href="/credits"
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink shadow-subtle hover:bg-surface"
      aria-label={balance === null ? 'Credits — add credits' : `${balance} credits — add credits`}
    >
      <Coins className="size-4 text-accent" aria-hidden />
      {balance ?? '–'}
      <Plus className="size-3.5 text-ink-muted" aria-hidden />
    </Link>
  )
}
