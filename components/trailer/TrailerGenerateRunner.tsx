'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Clapperboard, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

const STAGES = [
  'Analyzing manuscript & story blurb',
  'Composing cinematic scene cards',
  'Synthesizing mood soundtrack',
  'Rendering & encoding MP4 cuts',
]
const STAGE_MS = 2400

export function TrailerGenerateRunner({
  projectId,
  formatCount,
  durationLabel,
}: {
  projectId: string
  formatCount: number
  durationLabel: string
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
    router.replace(`/trailer/${projectId}/configure`)
    router.refresh()
  }

  useEffect(() => {
    if (started.current) return
    started.current = true

    const controller = new AbortController()
    abortControllerRef.current = controller

    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)
    timerRef.current = timer

    ;(async () => {
      try {
        const res = await fetch(`/api/trailer/projects/${projectId}/generate`, {
          method: 'POST',
          signal: controller.signal,
        })

        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
        if (isCancelledRef.current) return

        if (res.ok) {
          setStage(STAGES.length)
          toast.success('Your trailers are ready')
          router.replace(`/trailer/${projectId}/results`)
          router.refresh()
          return
        }

        const message =
          (await res.json().catch(() => ({})))?.error ?? 'Something went wrong rendering your video trailer.'
        router.replace(`/trailer/${projectId}/configure?error=${encodeURIComponent(message)}`)
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

        router.replace(
          `/trailer/${projectId}/configure?error=${encodeURIComponent(
            'Something went wrong rendering your video trailer. Please try again.'
          )}`
        )
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
          <Clapperboard className="size-7 animate-pulse" aria-hidden />
        </span>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Creating your book trailer</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Rendering {formatCount} video cut{formatCount === 1 ? '' : 's'} ({durationLabel}) with synced soundtrack and poster frames.
        </p>
      </div>

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
        {STAGES.map((label, i) => {
          const done = i < stage
          const active = i === stage
          return (
            <li
              key={label}
              className={cn('flex items-center gap-3 text-sm', !done && !active && 'text-ink-muted')}
            >
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

      <div className="flex w-full flex-col items-center gap-3 border-t border-line/60 pt-6">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-danger hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
        >
          <XCircle className="size-4" aria-hidden />
          {cancelling ? 'Cancelling render…' : 'Cancel generation'}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="size-3.5" aria-hidden />
          You can adjust scene parameters or styles anytime.
        </p>
      </div>
    </Card>
  )
}
