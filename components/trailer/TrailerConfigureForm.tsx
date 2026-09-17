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
  MessageSquareQuote,
  Music2,
  Smartphone,
  Sparkle,
  Sparkles,
  Square,
  Tv,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import { TrailerLivePreviewPlayer } from './TrailerLivePreviewPlayer'
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

const STYLE_HOOK_SUGGESTIONS: Record<TrailerStyle, string[]> = {
  fantasy: [
    'An ancient power awakens from the shadows...',
    'A destiny forged in fire and prophecy.',
    'Some legends refuse to be forgotten.',
  ],
  thriller: [
    'Some secrets refuse to stay buried.',
    'Trust no one. Question everything.',
    'The truth is far more dangerous than the lie.',
  ],
  scifi: [
    'Beyond the known universe lies humanity’s greatest threat.',
    'The signal was never meant to be answered.',
    'In the void of space, memories are currency.',
  ],
  romance: [
    'Two hearts divided by destiny, bound by passion.',
    'A love that defies all odds and expectations.',
    'Every heartbeat brings them closer to the truth.',
  ],
  cinematic: [
    'An extraordinary journey of courage and sacrifice.',
    'The epic saga that captivated readers worldwide.',
    'One choice changes everything forever.',
  ],
  minimal: [
    'A profound exploration of the human condition.',
    'A transformative perspective on modern life.',
    'Quietly devastating and undeniably brilliant.',
  ],
  dramatic: [
    'When the storm hits, only the strongest survive.',
    'An explosive clash where everything is at stake.',
    'No retreat. No surrender. No second chances.',
  ],
  energetic: [
    'The thrill-ride adventure of the year is here!',
    'Electrifying twists and non-stop momentum.',
    'Get ready for a story that will blow your mind.',
  ],
}

const CTA_SUGGESTIONS = [
  'AVAILABLE NOW • GET YOUR COPY TODAY',
  'ORDER TODAY ON AMAZON & BARNES & NOBLE',
  'READ THE BESTSELLER • IN STORES NOW',
  'PRE-ORDER NOW • COMING SOON',
]

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
    hookText?: string | null
    ctaText?: string | null
  }
  book: { title: string; author: string; blurb: string; coverUrl: string | null }
  error?: string
}) {
  const router = useRouter()
  const [aspectRatios, setAspectRatios] = useState<TrailerAspectRatio[]>(initial.aspectRatios)
  const [length, setLength] = useState<TrailerLength>(initial.length)
  const [style, setStyle] = useState<TrailerStyle>(initial.style)
  const [musicMood, setMusicMood] = useState<TrailerMusicMood>(initial.musicMood)
  const [hookText, setHookText] = useState<string>(initial.hookText ?? '')
  const [ctaText, setCtaText] = useState<string>(initial.ctaText ?? 'AVAILABLE NOW • GET YOUR COPY TODAY')
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
        hookText: hookText.trim() || null,
        ctaText: ctaText.trim() || null,
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

      {/* Interactive Remotion Live Preview */}
      <TrailerLivePreviewPlayer
        title={book.title}
        author={book.author}
        blurb={book.blurb}
        hookText={hookText}
        ctaText={ctaText}
        style={style}
        musicMood={musicMood}
        coverUrl={book.coverUrl}
        defaultAspectRatio={aspectRatios[0] ?? '9:16'}
      />

      {/* Visual Style Selection */}
      <Card className="p-6">
        <fieldset>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <legend className="flex items-center gap-2 font-display text-lg font-semibold">
              <Clapperboard className="size-5 text-accent" aria-hidden /> Visual Trailer Style
            </legend>
            <span className="text-xs text-ink-muted">
              Choose a template matched to your book’s genre & aesthetic
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Shapes the motion effects, background atmosphere, borders, and scene transitions.
          </p>
          <div role="radiogroup" aria-label="Visual Style" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    'group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
                    selected
                      ? 'border-accent shadow-card ring-2 ring-accent/30 bg-surface'
                      : 'border-line/60 bg-surface hover:border-accent/40 shadow-subtle'
                  )}
                >
                  {/* Style Preview Banner */}
                  <div
                    className="relative flex h-32 w-full flex-col items-center justify-center overflow-hidden p-4"
                    style={{ background: s.palette.background }}
                  >
                    {/* Visual style decorations */}
                    {s.key === 'fantasy' && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-2 border border-amber-500/40 rounded" />
                        <span className="absolute top-3 left-4 size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                        <span className="absolute bottom-4 right-5 size-2 rounded-full bg-yellow-300 shadow-[0_0_10px_#f59e0b]" />
                        <span className="absolute top-6 right-8 size-1 rounded-full bg-orange-400 shadow-[0_0_6px_#ea580c]" />
                      </div>
                    )}
                    {s.key === 'scifi' && (
                      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:100%_8px]" />
                    )}
                    {s.key === 'thriller' && (
                      <div className="absolute top-0 right-0 size-12 bg-red-600/20 blur-xl pointer-events-none" />
                    )}
                    {s.key === 'romance' && (
                      <div className="absolute inset-0 pointer-events-none bg-radial from-rose-500/15 to-transparent" />
                    )}

                    {/* Book graphic preview */}
                    <div className="relative flex items-center gap-3">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt=""
                          className="h-16 w-11 rounded object-cover shadow-lg ring-1 ring-white/10"
                        />
                      ) : (
                        <span
                          className="grid h-16 w-11 place-items-center rounded shadow"
                          style={{ background: s.palette.surface }}
                        >
                          <Clapperboard className="size-4 opacity-40" style={{ color: s.palette.accent }} />
                        </span>
                      )}
                      <div className="flex flex-col gap-1 max-w-[130px]">
                        <span
                          className="line-clamp-1 text-xs font-bold tracking-wider uppercase"
                          style={{ color: s.palette.ink }}
                        >
                          {book.title || 'Your Book'}
                        </span>
                        <span
                          className="h-0.5 w-6 rounded-full"
                          style={{ background: s.palette.accent }}
                        />
                        <span
                          className="text-[10px] opacity-75 truncate"
                          style={{ color: s.palette.ink }}
                        >
                          {s.tagline}
                        </span>
                      </div>
                    </div>

                    {/* Selected badge in banner */}
                    <span
                      className={cn(
                        'absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full border transition-all',
                        selected
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-white/20 bg-black/40 text-transparent'
                      )}
                    >
                      <Check className="size-3" aria-hidden />
                    </span>
                  </div>

                  {/* Style Info Card Content */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm">{s.label}</span>
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                          {s.tagline}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">{s.description}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1 pt-2 border-t border-line/40">
                      {s.bestFor.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-2/80 px-2 py-0.5 text-[10px] text-ink-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>
 
       {/* Hook & CTA Customization */}
       <Card className="p-6">
         <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
           <div className="flex items-center gap-2 font-display text-lg font-semibold">
             <MessageSquareQuote className="size-5 text-accent" aria-hidden /> Narrative Script & Hooks
           </div>
           <span className="text-xs text-ink-muted">
             Customizes Scene 1 (The Hook) & Scene 4 (Outro CTA)
           </span>
         </div>
         <p className="mt-1 text-sm text-ink-muted">
           Tune the opening teaser and final call-to-action to maximize viewer retention and book sales.
         </p>
 
         <div className="mt-5 flex flex-col gap-5">
           {/* Opening Hook Input */}
           <div className="flex flex-col gap-2">
             <div className="flex items-center justify-between">
               <label htmlFor="trailer-hook-text" className="text-sm font-medium">
                 Opening Hook Headline (Scene 1)
               </label>
               <span className="text-xs text-ink-muted">{hookText.length}/120</span>
             </div>
             <Input
               id="trailer-hook-text"
               value={hookText}
               onChange={(e) => setHookText(e.target.value)}
               placeholder={book.title || 'An Unforgettable Story'}
               maxLength={120}
             />
             <div className="flex flex-wrap items-center gap-1.5 pt-1">
               <span className="flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                 <Sparkle className="size-3 text-accent" /> Suggested for {STYLE_OPTIONS.find((s) => s.key === style)?.label}:
               </span>
               {(STYLE_HOOK_SUGGESTIONS[style] || []).map((suggestion) => (
                 <button
                   key={suggestion}
                   type="button"
                   onClick={() => setHookText(suggestion)}
                   className={cn(
                     'rounded-lg border px-2 py-0.5 text-xs transition-colors',
                     hookText === suggestion
                       ? 'border-accent bg-accent-soft text-ink font-medium ring-1 ring-accent/30'
                       : 'border-line/60 bg-surface-2 text-ink-muted hover:border-accent/40 hover:text-ink'
                   )}
                 >
                   &ldquo;{suggestion}&rdquo;
                 </button>
               ))}
             </div>
           </div>
 
           {/* Outro CTA Input */}
           <div className="flex flex-col gap-2 pt-2 border-t border-line/40">
             <div className="flex items-center justify-between">
               <label htmlFor="trailer-cta-text" className="text-sm font-medium">
                 Outro Call to Action Headline (Scene 4)
               </label>
               <span className="text-xs text-ink-muted">{ctaText.length}/100</span>
             </div>
             <Input
               id="trailer-cta-text"
               value={ctaText}
               onChange={(e) => setCtaText(e.target.value)}
               placeholder="AVAILABLE NOW • GET YOUR COPY TODAY"
               maxLength={100}
             />
             <div className="flex flex-wrap items-center gap-1.5 pt-1">
               <span className="text-[11px] font-medium text-ink-muted">Suggested CTAs:</span>
               {CTA_SUGGESTIONS.map((suggestion) => (
                 <button
                   key={suggestion}
                   type="button"
                   onClick={() => setCtaText(suggestion)}
                   className={cn(
                     'rounded-lg border px-2 py-0.5 text-xs transition-colors',
                     ctaText === suggestion
                       ? 'border-accent bg-accent-soft text-ink font-medium ring-1 ring-accent/30'
                       : 'border-line/60 bg-surface-2 text-ink-muted hover:border-accent/40 hover:text-ink'
                   )}
                 >
                   {suggestion}
                 </button>
               ))}
             </div>
           </div>
         </div>
       </Card>
 
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
