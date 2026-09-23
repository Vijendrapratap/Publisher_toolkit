'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clapperboard, Download, Loader2, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { BRIEF_LIMITS, aiVideoBriefSchema, type AiVideoBrief } from '@/lib/services/ads/aiVideoBriefSchema'
import { pickDuration } from '@/lib/providers/aiVideo'
import type { AiVideoJobSummary } from '@/lib/services/ads/aiVideoJob'

interface ModelInfo {
  id: string
  pricePerSecond: number | null
  durations: number[]
  aspectRatios: string[]
}

export interface AiVideoPanelProps {
  projectId: string
  coverUrl: string | null
  pageUrls: string[]
  initialBrief: AiVideoBrief | null
}

const ACTIVE = new Set(['running', 'stitching'])
const SHOT_LABELS: Record<AiVideoJobSummary['shots'][number]['status'], string> = {
  pending: 'queued',
  in_progress: 'animating',
  downloading: 'saving',
  completed: 'done',
  failed: 'failed',
}
const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-ai focus:ring-2 focus:ring-ai/25'
const labelClass = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted'

export function AiVideoPanel({ projectId, coverUrl, pageUrls, initialBrief }: AiVideoPanelProps) {
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState<AiVideoBrief | null>(initialBrief)
  const [instruction, setInstruction] = useState('')
  const [writing, setWriting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<AiVideoJobSummary | null>(null)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [aiConfigured, setAiConfigured] = useState(true)

  const images = [{ key: 'cover', label: 'Cover', url: coverUrl }, ...pageUrls.slice(0, 5).map((url, i) => ({ key: `page-${i + 1}`, label: `Page ${i + 1}`, url }))]
  const durations = (model?.durations.length ? model.durations : [4, 5, 6, 8]).filter((d) => d >= 3 && d <= 10)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai`)
    if (!res.ok) return
    const body = await res.json()
    setJob(body.job)
    setModel(body.model)
    setAiConfigured(body.aiConfigured)
  }, [projectId])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  // Self-scheduling: the next poll is only queued once the previous fetch has
  // resolved (a fixed 5s gap between calls, never an overlapping request),
  // and only while the job is still running/stitching. Re-running this effect
  // whenever `job` changes both restarts the chain after every poll and stops
  // it the moment the job leaves the active set.
  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) void refresh()
    }, 5000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [job, refresh])

  const check = brief ? aiVideoBriefSchema.safeParse(brief) : null
  const problem = check && !check.success ? check.error.issues[0]?.message : null
  const seconds = brief ? brief.shots.reduce((t, s) => t + pickDuration(s.durationSec, model?.durations ?? []), 0) : 0
  const estimate = model?.pricePerSecond ? seconds * model.pricePerSecond : null
  const busy = Boolean(job && ACTIVE.has(job.status))

  async function writeBrief(revise: boolean) {
    setWriting(true)
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: revise ? brief : undefined, instruction: instruction || undefined }),
    })
    const body = await res.json().catch(() => ({}))
    setWriting(false)
    if (!res.ok) {
      toast.error(body.error ?? 'The AI could not write the prompt.')
      return
    }
    setBrief(body.brief)
    if (body.source === 'fallback') toast.warning('AI was unavailable, so a starter prompt was filled in. Edit it before generating.')
    setInstruction('')
  }

  async function generate() {
    if (!check?.success) return
    setStarting(true)
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: check.data }),
    })
    const body = await res.json().catch(() => ({}))
    setStarting(false)
    if (!res.ok) {
      toast.error(body.error ?? 'The AI video could not be started.')
      return
    }
    setJob(body.job)
    toast.success('AI video started', { description: 'Each shot takes a few minutes. You can keep working.' })
  }

  const setShot = (i: number, patch: Partial<AiVideoBrief['shots'][number]>) =>
    setBrief((b) => b && { ...b, shots: b.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-3xl border border-ai/30 bg-ai-soft p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Want something more cinematic?</p>
          <p className="text-sm text-ink-muted">An AI video made from your cover and pages. You review and edit the prompt first.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="bg-ai text-canvas hover:bg-ai/90">
          <Sparkles className="size-4" aria-hidden /> Generate with AI
        </Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="ai-video-title" className="rounded-3xl border border-ai/30 bg-ai-soft p-5 shadow-card sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-ai text-canvas">
            <Clapperboard className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id="ai-video-title" className="font-display text-lg font-semibold text-ink">AI Video</h3>
            <p className="text-sm text-ink-muted">Each shot animates one of your images. Your real cover and call to action close the video.</p>
          </div>
        </div>
        <button type="button" aria-label="Close AI video" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {!aiConfigured && (
        <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          AI video needs an OpenRouter API key. <a href="/settings" className="font-semibold underline">Add it in Settings</a>.
        </p>
      )}

      {job && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          {job.status === 'completed' && job.videoUrl ? (
            <div className="flex flex-col gap-3">
              <video controls playsInline poster={job.posterUrl ?? undefined} src={job.videoUrl} className="max-h-[70vh] w-full rounded-xl bg-black object-contain" />
              <div className="flex flex-wrap items-center gap-3">
                <a href={job.videoUrl} download="ai-video-ad.mp4" className={cn(buttonClasses({ size: 'sm' }), 'bg-ai text-canvas hover:bg-ai/90')}>
                  <Download className="size-3.5" aria-hidden /> Download AI video
                </a>
                {job.costUsd !== null && <span className="text-sm text-ink-muted">Cost: ${job.costUsd.toFixed(2)}</span>}
              </div>
            </div>
          ) : job.status === 'failed' ? (
            <p role="alert" className="text-sm text-danger">The AI video didn’t finish: {job.error}. Edit the prompt and generate again.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Loader2 className="size-4 animate-spin text-ai" aria-hidden />
                {job.status === 'stitching' ? 'Putting your video together…' : 'The AI is animating your shots. This takes a few minutes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {job.shots.map((shot, i) => (
                  <span
                    key={i}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      shot.status === 'completed'
                        ? 'bg-ai text-canvas'
                        : shot.status === 'failed'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-surface-2 text-ink-muted'
                    )}
                  >
                    Shot {i + 1}: {SHOT_LABELS[shot.status]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!brief ? (
        <div className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Direction for the AI (optional)</span>
            <input className={inputClass} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. warm and magical, start with the cover" />
          </label>
          <Button type="button" onClick={() => writeBrief(false)} loading={writing} disabled={writing || !aiConfigured} className="self-start bg-ai text-canvas hover:bg-ai/90">
            <Wand2 className="size-4" aria-hidden /> Write the video prompt
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {brief.shots.map((shot, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Shot {i + 1}</span>
                {brief.shots.length > 1 && (
                  <button type="button" aria-label={`Remove shot ${i + 1}`} onClick={() => setBrief({ ...brief, shots: brief.shots.filter((_, j) => j !== i) })} className="text-ink-muted hover:text-danger">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Shot ${i + 1} image`}>
                {images.map((image) => (
                  <button
                    key={image.key}
                    type="button"
                    role="radio"
                    aria-checked={shot.sourceImage === image.key}
                    onClick={() => setShot(i, { sourceImage: image.key })}
                    className={cn('flex items-center gap-2 rounded-xl border px-2 py-1 text-xs transition', shot.sourceImage === image.key ? 'border-ai ring-2 ring-ai/30' : 'border-line hover:border-ai/50')}
                  >
                    {image.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" className="h-8 w-6 rounded object-cover" />
                    )}
                    {image.label}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex flex-col gap-1.5">
                <span className={labelClass}>What happens <span className="font-normal normal-case">{shot.prompt.length}/{BRIEF_LIMITS.prompt}</span></span>
                <textarea aria-label={`Shot ${i + 1} prompt`} rows={3} className={inputClass} value={shot.prompt} onChange={(e) => setShot(i, { prompt: e.target.value })} />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Length</span>
                  <select className={inputClass} value={pickDuration(shot.durationSec, durations)} onChange={(e) => setShot(i, { durationSec: Number(e.target.value) })}>
                    {durations.map((d) => (
                      <option key={d} value={d}>{d} seconds</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Caption (optional) <span className="font-normal normal-case">{shot.caption.length}/{BRIEF_LIMITS.caption}</span></span>
                  <input className={inputClass} value={shot.caption} onChange={(e) => setShot(i, { caption: e.target.value })} />
                </label>
              </div>
            </div>
          ))}

          {brief.shots.length < BRIEF_LIMITS.shots && (
            <button
              type="button"
              onClick={() => setBrief({ ...brief, shots: [...brief.shots, { prompt: '', sourceImage: 'cover', durationSec: 5, caption: '' }] })}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-ai hover:underline"
            >
              <Plus className="size-3.5" aria-hidden /> Add a shot
            </button>
          )}

          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>End card headline <span className="font-normal normal-case">{brief.endCard.headline.length}/{BRIEF_LIMITS.headline}</span></span>
              <input className={inputClass} value={brief.endCard.headline} onChange={(e) => setBrief({ ...brief, endCard: { ...brief.endCard, headline: e.target.value } })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Call to action <span className="font-normal normal-case">{brief.endCard.cta.length}/{BRIEF_LIMITS.cta}</span></span>
              <input className={inputClass} value={brief.endCard.cta} onChange={(e) => setBrief({ ...brief, endCard: { ...brief.endCard, cta: e.target.value } })} />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={inputClass} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Tell the AI what to change, e.g. darker mood, open on page 2" aria-label="Revision instruction" />
            <Button type="button" variant="secondary" onClick={() => writeBrief(true)} loading={writing} disabled={writing || !aiConfigured} className="shrink-0">
              <Wand2 className="size-4" aria-hidden /> Revise with AI
            </Button>
          </div>

          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ai/20 pt-4">
            <p className="text-sm text-ink-muted">
              {estimate !== null ? `Estimated ≈ $${estimate.toFixed(2)} · ${seconds} seconds of AI video` : `${seconds} seconds of AI video`}
              {model ? ` · ${model.id}` : ''}
            </p>
            <Button type="button" onClick={generate} loading={starting} disabled={starting || busy || Boolean(problem) || !aiConfigured} className="bg-ai text-canvas hover:bg-ai/90">
              <Sparkles className="size-4" aria-hidden /> Generate AI video
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
