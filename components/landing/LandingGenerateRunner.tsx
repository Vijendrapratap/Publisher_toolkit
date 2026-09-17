'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Sparkles, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function LandingGenerateRunner({
  projectId,
  title,
}: {
  projectId: string
  title: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    let active = true

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + 15))
    }, 400)

    async function publishSite() {
      try {
        const res = await fetch(`/api/landing/projects/${projectId}/generate`, {
          method: 'POST',
        })

        if (!active) return

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to publish landing page.')
        }

        setProgress(100)
        clearInterval(interval)
        setTimeout(() => {
          router.push(`/landing/${projectId}/results`)
          router.refresh()
        }, 600)
      } catch (err) {
        if (!active) return
        clearInterval(interval)
        setError(err instanceof Error ? err.message : 'Publishing failed.')
      }
    }

    publishSite()

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [projectId, router])

  return (
    <Card className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      {!error ? (
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="relative">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-card">
              <Globe className="size-8 animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent shadow">
              <Sparkles className="size-3" />
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-xl font-semibold">Publishing Book Landing Website...</h2>
            <p className="text-sm text-ink-muted">
              Compiling responsive HTML, social meta tags, and generating public link for &ldquo;{title}&rdquo;
            </p>
          </div>

          <div className="w-full">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs font-mono text-ink-muted">
              <span>Generating production bundle</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="font-display text-lg font-semibold">Publishing Failed</h2>
          <p className="text-sm text-danger">{error}</p>
          <Button onClick={() => window.location.reload()} variant="primary" size="md">
            <RefreshCw className="size-4" /> Try Again
          </Button>
        </div>
      )}
    </Card>
  )
}
