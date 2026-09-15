'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenerateButton({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    await fetch(`/api/ads/projects/${bookId}/generate`, { method: 'POST' })
    setPending(false)
    router.refresh()
  }

  return (
    <button onClick={handleClick} disabled={pending} className="bg-black text-white rounded px-4 py-2">
      {pending ? 'Generating…' : 'Generate creatives'}
    </button>
  )
}
