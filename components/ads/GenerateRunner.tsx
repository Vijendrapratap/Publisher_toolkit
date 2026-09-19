'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

const STAGES = [
  'Synthesizing book metadata',
  'Writing ad copy with AI (~250 text tokens)',
  'Composing banner creatives',
  'Finalizing ad package',
]
const STAGE_MS = 2200

export function GenerateRunner({
  projectId,
  platformCount,
  sizeCount,
}: {
  projectId: string
  platformCount: number
  sizeCount: number
}) {
  const router = useRouter()
  const started = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCancelledRef = useRef(false)
  const [stage, setStage] = useState(0)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = () => {
    if (cancelling || isCancelledRef.current) return
    isCancelledRef.current = true
    setCancelling(true)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    toast.info('Generation cancelled')
    router.replace(`/ads/${projectId}/configure`)
    router.refresh()
  }

  useEffect(() => {
    // React strict mode mounts twice in dev; generation must run once.
    if (started.current) return
    started.current = true

    const controller = new AbortController()
    abortControllerRef.current = controller

    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)
    timerRef.current = timer

    ;(async () => {
      try {
        const res = await fetch(`/api/ads/projects/${projectId}/generate`, {
          method: 'POST',
          signal: controller.signal,
        })
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
        if (isCancelledRef.current) return

        if (res.ok) {
          setStage(STAGES.length)
          toast.success('Your creatives are ready')
          router.replace(`/ads/${projectId}/results`)
          router.refresh()
          return
        }
        const message = (await res.json().catch(() => ({})))?.error ?? 'Something went wrong. Please try again.'
        router.replace(`/ads/${projectId}/configure?error=${encodeURIComponent(message)}`)
        router.refresh()
      } catch (err: unknown) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
        if (isCancelledRef.current) return

        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }

        router.replace(`/ads/${projectId}/configure?error=${encodeURIComponent('Something went wrong. Please try again.')}`)
        router.refresh()
      }
    })()

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [projectId, router])

  const percent = Math.round((Math.min(stage + 1, STAGES.length) / STAGES.length) * 100)

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-8 text-center sm:p-10">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
        <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-subtle">
          <Loader2 className="size-7 animate-spin" aria-hidden />
        </span>
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Creating your ads</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {sizeCount} sizes across {platformCount} {platformCount === 1 ? 'platform' : 'platforms'}. This usually takes under a minute.
        </p>
      </div>

      {/* Transparency callout */}
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-line/70 bg-surface-2/60 p-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-accent shadow-subtle">
          <ShieldCheck className="size-3.5 text-accent" aria-hidden />
          Text-only prompt • Zero interior images processed • ~250 tokens total
        </span>
        <p className="text-xs text-ink-muted">
          Full book text and images are never sent to the AI model.
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 shadow-inset" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="flex w-full flex-col gap-3 text-left" aria-live="polite">
        {STAGES.map((label, i) => {
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
                {done ? <Check className="size-3.5" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              </span>
              <span className={cn(active && 'font-medium')}>{label}</span>
            </li>
          )
        })}
      </ol>

      {/* Stop / Cancel generation */}
      <div className="pt-2">
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
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cancelling…
            </>
          ) : (
            <>
              <XCircle className="size-4" aria-hidden />
              Stop / Cancel generation
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
