'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertCircle,
  Check,
  Clapperboard,
  Clock,
  Film,
  Music2,
  Smartphone,
  Square,
  Tv,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import {
  ASPECT_RATIO_OPTIONS,
  LENGTH_OPTIONS,
  STYLE_OPTIONS,
  MUSIC_MOOD_OPTIONS,
  type TrailerAspectRatio,
  type TrailerLength,
  type TrailerStyle,
  type TrailerMusicMood,
} from '@/lib/services/trailer/options'

const ASPECT_ICONS: Record<string, React.ElementType> = {
  '9:16': Smartphone,
  '1:1': Square,
  '16:9': Tv,
}

export function TrailerConfigureForm({
  projectId,
  initial,
  book,
  error: generationError,
}: {
  projectId: string
  initial: {
    aspectRatios: TrailerAspectRatio[]
    length: TrailerLength
    style: TrailerStyle
    musicMood: TrailerMusicMood
  }
  book: { title: string; author: string; blurb: string; coverUrl: string | null }
  error?: string
}) {
  const router = useRouter()
  const [aspectRatios, setAspectRatios] = useState<TrailerAspectRatio[]>(initial.aspectRatios)
  const [length, setLength] = useState<TrailerLength>(initial.length)
  const [style, setStyle] = useState<TrailerStyle>(initial.style)
  const [musicMood, setMusicMood] = useState<TrailerMusicMood>(initial.musicMood)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleAspectRatio = (key: TrailerAspectRatio) => {
    setAspectRatios((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (aspectRatios.length === 0) {
      setError('Choose at least one aspect ratio.')
      return
    }
    setPending(true)
    setError(null)
    const res = await fetch(`/api/trailer/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aspectRatios: ASPECT_RATIO_OPTIONS.map((a) => a.key).filter((k) => aspectRatios.includes(k)),
        length,
        style,
        musicMood,
      }),
    })
    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'We couldn’t save your settings.'
      setError(message)
      toast.error(message)
      return
    }
    router.push(`/trailer/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {generationError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-card bg-danger/10 p-4 shadow-subtle ring-1 ring-danger/30 sm:flex-row sm:items-center"
        >
          <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Generation didn’t finish.</span> {generationError}
          </p>
          <Button type="submit" variant="danger" size="sm" className="sm:ml-auto" loading={pending}>
            Try again
          </Button>
        </div>
      )}

      {/* Aspect Ratios */}
      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Film className="size-5 text-accent" aria-hidden /> Aspect Ratios & Formats
          </legend>
          <p className="text-sm text-ink-muted">Select all video formats you want to generate.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ASPECT_RATIO_OPTIONS.map((a) => {
              const selected = aspectRatios.includes(a.key)
              const Icon = ASPECT_ICONS[a.key] ?? Film
              return (
                <button
                  key={a.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggleAspectRatio(a.key)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span
                    className={cn(
                      'absolute right-3 top-3 grid size-5 place-items-center rounded-full border',
                      selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2'
                    )}
                  >
                    {selected && <Check className="size-3" aria-hidden />}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-accent">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="font-semibold">{a.label}</span>
                  </div>
                  <span className="text-xs text-ink-muted">{a.description}</span>
                  <span className="mt-1 rounded-md bg-surface-2/80 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                    {a.width}×{a.height}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Video Length */}
      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Clock className="size-5 text-accent" aria-hidden /> Trailer Duration
          </legend>
          <p className="text-sm text-ink-muted">Choose the pacing and runtime for your video.</p>
          <div role="radiogroup" aria-label="Trailer Duration" className="mt-4 grid gap-3 sm:grid-cols-3">
            {LENGTH_OPTIONS.map((l) => {
              const selected = length === l.key
              return (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setLength(l.key)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{l.label}</span>
                  <span className="text-xs text-ink-muted">{l.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Visual Style */}
      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Clapperboard className="size-5 text-accent" aria-hidden /> Visual Style
          </legend>
          <p className="text-sm text-ink-muted">Color grading, scene typography, and transitions.</p>
          <div role="radiogroup" aria-label="Visual Style" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STYLE_OPTIONS.map((s) => {
              const selected = style === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setStyle(s.key)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-xs text-ink-muted">{s.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Music Mood */}
      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Music2 className="size-5 text-accent" aria-hidden /> Music Mood & Audio Atmosphere
          </legend>
          <p className="text-sm text-ink-muted">Soundtrack tones synthesized to evoke your book’s genre.</p>
          <div role="radiogroup" aria-label="Music Mood" className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {MUSIC_MOOD_OPTIONS.map((m) => {
              const selected = musicMood === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMusicMood(m.key)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-xs text-ink-muted">{m.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-ink-muted">
          {aspectRatios.length === 0
            ? 'No formats selected'
            : `${aspectRatios.length} video cut${aspectRatios.length === 1 ? '' : 's'} (${length})`}
        </span>
        <Button type="submit" size="lg" loading={pending} disabled={aspectRatios.length === 0}>
          <Clapperboard className="size-4" aria-hidden /> Generate trailers
        </Button>
      </div>
    </form>
  )
}
