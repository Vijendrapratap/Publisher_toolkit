'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

const STAGES = ['Reading your book', 'Writing ad copy', 'Composing images', 'Saving your creatives']
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
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // React strict mode mounts twice in dev; generation must run once.
    if (started.current) return
    started.current = true

    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)

    ;(async () => {
      const res = await fetch(`/api/ads/projects/${projectId}/generate`, { method: 'POST' }).catch(() => null)
      clearInterval(timer)
      if (res?.ok) {
        setStage(STAGES.length)
        toast.success('Your creatives are ready')
        router.replace(`/ads/${projectId}/results`)
        router.refresh()
        return
      }
      const message = (await res?.json().catch(() => ({})))?.error ?? 'Something went wrong. Please try again.'
      router.replace(`/ads/${projectId}/configure?error=${encodeURIComponent(message)}`)
      router.refresh()
    })()

    return () => clearInterval(timer)
  }, [projectId, router])

  const percent = Math.round((Math.min(stage + 1, STAGES.length) / STAGES.length) * 100)

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-8 text-center sm:p-10">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
        <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-lift">
          <Loader2 className="size-7 animate-spin" aria-hidden />
        </span>
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Creating your ads</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {sizeCount} sizes across {platformCount} {platformCount === 1 ? 'platform' : 'platforms'}. This usually takes under a minute.
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
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
                  done && 'bg-success text-white',
                  active && 'bg-accent-soft text-accent',
                  !done && !active && 'border border-line'
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              </span>
              <span className={cn(active && 'font-medium')}>{label}</span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
