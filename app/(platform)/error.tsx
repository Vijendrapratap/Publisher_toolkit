'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { LifeBuoy, RotateCcw } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-danger/10 text-danger">
        <LifeBuoy className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Something went sideways</h1>
      <p className="mt-3 text-ink-muted">That didn’t load the way it should. Your projects are safe, so try again.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden /> Try again
        </Button>
        <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
          All tools
        </Link>
      </div>
    </div>
  )
}
