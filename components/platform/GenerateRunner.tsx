'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Check, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

export interface GenerateRunnerProps {
  /** POSTed once on mount to produce the output. */
  endpoint: string
  /** Where to go on success and on cancel, respectively. */
  successHref: string
  cancelHref: string
  title: string
  subtitle: ReactNode
  /** Labels for the visual progress list; purely indicative of elapsed work. */
  stages: string[]
  stageMs?: number
  icon: ReactNode
  successMessage: string
  /** Rendered under the progress bar, e.g. a privacy note. */
  footnote?: ReactNode
}

/**
 * Every service generates the same way: fire one POST, show progress while it
 * runs, then route to results or back to configure with the error. This was
 * four near-identical components that had drifted apart — only one of them
 * could be cancelled, and two silently dropped the server's error message.
 */
export function GenerateRunner({
  endpoint,
  successHref,
  cancelHref,
  title,
  subtitle,
  stages,
  stageMs = 2200,
  icon,
  successMessage,
  footnote,
}: GenerateRunnerProps) {
  const router = useRouter()
  const started = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const cancelled = useRef(false)
  const [stage, setStage] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    if (cancelling || cancelled.current) return
    cancelled.current = true
    setCancelling(true)
    abortRef.current?.abort()
    toast.info('Generation cancelled')
    router.replace(cancelHref)
    router.refresh()
  }

  useEffect(() => {
    // React strict mode mounts twice in dev; generation must run once.
    if (started.current) return
    started.current = true

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), stageMs)

    ;(async () => {
      try {
        const res = await fetch(endpoint, { method: 'POST', signal: controller.signal })
        if (cancelled.current) return

        if (res.ok) {
          setStage(stages.length)
          // A 2xx can still mean "finished, but not entirely" — e.g. the images
          // rendered and the trailer did not.
          const { warning } = (await res.json().catch(() => ({}))) as { warning?: string }
          if (warning) toast.warning(successMessage, { description: warning, duration: 8000 })
          else toast.success(successMessage)
          router.replace(successHref)
          router.refresh()
          return
        }

        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Something went wrong. Please try again.')
      } catch (err) {
        if (cancelled.current || (err instanceof Error && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        clearInterval(timer)
      }
    })()

    return () => {
      clearInterval(timer)
    }
  }, [endpoint, successHref, successMessage, stages.length, stageMs, router])

  if (error) {
    return (
      <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 p-8 text-center sm:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
          <AlertCircle className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-xl font-semibold">{title} didn&rsquo;t finish</h2>
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.replace(cancelHref)}>
            Back to settings
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden /> Try again
          </Button>
        </div>
      </Card>
    )
  }

  const percent = Math.round((Math.min(stage + 1, stages.length) / stages.length) * 100)

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-8 text-center sm:p-10">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
        <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-subtle">
          {icon}
        </span>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
      </div>

      {footnote}

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2 shadow-inset"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="flex w-full flex-col gap-3 text-left" aria-live="polite">
        {stages.map((label, i) => {
          const done = i < stage
          const active = i === stage
          return (
            <li key={label} className={cn('flex items-center gap-3 text-sm', !done && !active && 'text-ink-muted')}>
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full',
                  done && 'bg-success text-on-accent',
                  active && 'bg-accent-soft text-accent shadow-subtle',
                  !done && !active && 'bg-surface-2 shadow-inset'
                )}
              >
                {done ? (
                  <Check className="size-3.5" aria-hidden />
                ) : active ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
              </span>
              <span className={cn(active && 'font-medium')}>{label}</span>
            </li>
          )
        })}
      </ol>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={cancelling}
        onClick={handleCancel}
        className="gap-2 text-ink-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
      >
        {cancelling ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cancelling…
          </>
        ) : (
          <>
            <XCircle className="size-4" aria-hidden /> Cancel generation
          </>
        )}
      </Button>
    </Card>
  )
}
