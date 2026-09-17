'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Headphones, Sparkles, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function AudiobookGenerateRunner({
  projectId,
  title,
  chapterCount,
}: {
  projectId: string
  title: string
  chapterCount: number
}) {
  const router = useRouter()
  const [stage, setStage] = useState<'synthesizing' | 'concatenating' | 'done' | 'error'>('synthesizing')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(10)

  useEffect(() => {
    let active = true

    // Fake progressive visual feedback while waiting for synthesis API
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.floor(Math.random() * 8) + 2
      })
    }, 1000)

    async function runSynthesis() {
      try {
        const res = await fetch(`/api/audiobook/projects/${projectId}/generate`, {
          method: 'POST',
        })

        if (!active) return

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Audiobook synthesis failed.')
        }

        setProgress(100)
        setStage('done')
        clearInterval(interval)
        setTimeout(() => {
          router.push(`/audiobook/${projectId}/results`)
          router.refresh()
        }, 800)
      } catch (err) {
        if (!active) return
        clearInterval(interval)
        setStage('error')
        setError(err instanceof Error ? err.message : 'Audiobook synthesis encountered an error.')
      }
    }

    runSynthesis()

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [projectId, router])

  return (
    <Card className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
      {stage !== 'error' ? (
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="relative">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-card">
              <Headphones className="size-8 animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent shadow">
              <Sparkles className="size-3" />
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-xl font-semibold">
              {progress < 85 ? 'Synthesizing Neural Narration...' : 'Mastering & Assembling Chapters...'}
            </h2>
            <p className="text-sm text-ink-muted">
              Generating voice audio for {chapterCount} chapter{chapterCount === 1 ? '' : 's'} in &ldquo;{title}&rdquo;
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs font-mono text-ink-muted">
              <span>{progress < 90 ? 'Neural prosody synthesis' : 'Concatenating full audiobook'}</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="font-display text-lg font-semibold">Synthesis Incomplete</h2>
          <p className="text-sm text-danger">{error}</p>
          <Button onClick={() => window.location.reload()} variant="primary" size="md">
            <RefreshCw className="size-4" /> Try Again
          </Button>
        </div>
      )}
    </Card>
  )
}
