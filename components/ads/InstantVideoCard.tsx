'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Download, Film, Music, Pause, Play, Save, Sparkles, Upload, X, Zap } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { BEAT_LABELS, BookAdPlayer } from '@/components/ads/BookAdPlayer'
import { adFontFamily } from '@/components/trailer/remotion/fonts'
import {
  AD_FONTS,
  MUSIC_TRACKS,
  adVideoSpecSchema,
  musicUrl,
  presetStyle,
  resolveMusic,
  type AdFontKey,
  type AdVideoSpec,
} from '@/lib/services/ads/videoSpec'
import { STORYBOARD_LIMITS, fitToLength, type Beat, type Particle, type Storyboard, type StoryboardTheme } from '@/lib/services/ads/storyboard'
import { ASPECT_RATIO_OPTIONS, LENGTH_OPTIONS, STYLE_OPTIONS, getDurationForLength } from '@/lib/services/trailer/options'
import { CREDIT_PRICES } from '@/lib/credits/prices'

type DirectedSpec = AdVideoSpec & { storyboard: Storyboard }

export interface InstantVideoCardProps {
  projectId: string
  title: string
  author: string
  coverUrl: string | null
  pageUrls: string[]
  /** Pages a scene may show (at most 6). */
  pageCount: number
  initialSpec: DirectedSpec
  /** True once the AI (not the fixed plan) wrote the scenes. */
  directed: boolean
  video: { videoUrl: string | null; videoPosterUrl: string | null; videoDuration: number | null }
}

const PALETTE_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'ink', label: 'Text' },
  { key: 'accent', label: 'Highlight' },
] as const

const EFFECTS: { key: Particle; label: string }[] = [
  { key: 'leaves', label: 'Falling leaves' },
  { key: 'snow', label: 'Snow' },
  { key: 'dust', label: 'Dust in the light' },
  { key: 'embers', label: 'Embers' },
  { key: 'none', label: 'None' },
]

const HEX = /^#[0-9a-f]{6}$/i
const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-instant focus:ring-2 focus:ring-instant/25'
const labelClass = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted'
const iconButton = 'grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-surface hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent'

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('text-[11px] font-normal normal-case tabular-nums', value.length > max ? 'font-semibold text-danger' : 'text-ink-muted')}>
      {value.length}/{max}
    </span>
  )
}

export function InstantVideoCard({ projectId, title, author, coverUrl, pageUrls, pageCount, initialSpec, directed: initiallyDirected, video }: InstantVideoCardProps) {
  const [spec, setSpec] = useState<DirectedSpec>(initialSpec)
  const [saved, setSaved] = useState<DirectedSpec>(initialSpec)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [directing, setDirecting] = useState(false)
  const [directed, setDirected] = useState(initiallyDirected)
  const [instruction, setInstruction] = useState('')
  const [current, setCurrent] = useState(video)
  const [fontFamilies, setFontFamilies] = useState<Partial<Record<AdFontKey, string>>>({})
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const storyboard = spec.storyboard
  const beats = storyboard.beats
  const music = resolveMusic(spec)
  const musicValue = music.kind === 'library' ? music.track : music.kind
  const setMusic = (next: NonNullable<AdVideoSpec['music']>) => {
    audioRef.current?.pause()
    setPlaying(false)
    setSpec((s) => ({ ...s, music: next }))
  }
  const setBeats = (fn: (b: Beat[]) => Beat[]) => setSpec((s) => ({ ...s, storyboard: { ...s.storyboard, beats: fn(s.storyboard.beats) } }))
  const setBeat = (i: number, patch: Partial<Beat>) => setBeats((b) => b.map((beat, j) => (j === i ? ({ ...beat, ...patch } as Beat) : beat)))
  const setTheme = (patch: Partial<StoryboardTheme>) => setSpec((s) => ({ ...s, storyboard: { ...s.storyboard, theme: { ...s.storyboard.theme, ...patch } } }))
  const move = (i: number, by: -1 | 1) =>
    setBeats((b) => {
      const next = [...b]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })

  // Loaded after mount: the font loader needs `document`.
  useEffect(() => {
    setFontFamilies(Object.fromEntries(AD_FONTS.map((f) => [f.key, adFontFamily(f.key)])))
  }, [])

  async function uploadMusic(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/ads/projects/${projectId}/music`, { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'We couldn’t upload that file.')
        return
      }
      setMusic({ kind: 'upload', url: body.url, name: body.name })
    } catch {
      toast.error('We couldn’t upload that file.', { description: 'Check your connection and try again.' })
    } finally {
      setUploading(false)
    }
  }

  function togglePreview() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      setPlaying(true)
      audio.play().catch(() => setPlaying(false))
    }
  }

  const dirty = JSON.stringify(spec) !== JSON.stringify(saved)
  const check = adVideoSpecSchema.safeParse(spec)
  const problem = check.success ? null : (check.error.issues[0]?.message ?? 'Check the scenes')

  async function save(): Promise<boolean> {
    if (!check.success) {
      toast.error(problem ?? 'Check the scenes')
      return false
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ads/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoSpec: check.data }),
      })
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your video.')
        return false
      }
      setSaved(spec)
      toast.success('Video saved')
      return true
    } catch {
      toast.error('We couldn’t save your video.', { description: 'Check your connection and try again.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function direct(revise: boolean) {
    if (dirty && !(await save())) return
    setDirecting(true)
    try {
      const res = await fetch(`/api/ads/projects/${projectId}/video/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revise, instruction: instruction.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'We couldn’t plan your ad.')
        return
      }
      setSpec(json.spec)
      setSaved(json.spec)
      setInstruction('')
      setDirected(true)
      if (json.source === 'fallback') toast.warning('The AI was busy, so we used a simple plan. Try again in a moment.')
      else toast.success('Your ad is planned. Press play to watch it.')
    } catch {
      toast.error('We couldn’t plan your ad.', { description: 'Check your connection and try again.' })
    } finally {
      setDirecting(false)
    }
  }

  async function exportVideo() {
    if (dirty && !(await save())) return
    setExporting(true)
    const toastId = toast.loading('Rendering your video…', { description: 'This can take a few minutes for longer videos.' })
    try {
      const res = await fetch(`/api/ads/projects/${projectId}/video/instant`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('Export failed', { id: toastId, description: json.error })
        return
      }
      setCurrent(json)
      toast.success('Your video is ready', { id: toastId, description: 'Download it below the title.' })
    } catch {
      toast.error('Export failed', { id: toastId, description: 'Check your connection and try again.' })
    } finally {
      setExporting(false)
      window.dispatchEvent(new Event('credits:changed'))
    }
  }

  const pageOptions = Array.from({ length: pageCount }, (_, i) => i + 1)

  return (
    <section aria-labelledby="instant-video-title" className="rounded-3xl border border-instant/20 bg-instant-soft p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-instant text-canvas">
            <Zap className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id="instant-video-title" className="font-display text-lg font-semibold text-ink">Video ad</h3>
            <p className="text-sm text-ink-muted">AI looks at your cover and pages and plans each scene. Edit any scene below.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {current.videoUrl && (
            <a href={current.videoUrl} download="video-ad.mp4" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <Download className="size-3.5" aria-hidden /> Download MP4{current.videoDuration ? ` (${current.videoDuration}s)` : ''}
            </a>
          )}
          <Button type="button" size="sm" onClick={save} loading={saving} disabled={!dirty || saving} variant="secondary">
            <Save className="size-3.5" aria-hidden /> Save
          </Button>
          <Button type="button" size="sm" onClick={exportVideo} loading={exporting} disabled={exporting || Boolean(problem)} className="bg-instant text-canvas hover:bg-instant/90">
            <Film className="size-3.5" aria-hidden /> Save &amp; export MP4 · {CREDIT_PRICES['ads.video.instant']} credits
          </Button>
        </div>
      </header>

      {problem && dirty && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{problem}</p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
        {/*
          `contents` below `lg` lets these children join the parent grid's own flow, so `order-*`
          can interleave them with the editor column's children into the mobile stacking order;
          `lg:flex lg:flex-col` makes this a real sticky column at `lg`.
        */}
        <div data-column="preview" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="order-1 flex flex-col gap-3">
            {directed ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>What should change?</span>
                  <input
                    className={inputClass}
                    value={instruction}
                    maxLength={400}
                    placeholder="e.g. Start with the puzzle pages, make it feel spookier"
                    onChange={(e) => setInstruction(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" onClick={() => direct(true)} loading={directing} disabled={directing}>
                    <Sparkles className="size-3.5" aria-hidden /> Change it
                  </Button>
                  <button type="button" onClick={() => direct(false)} disabled={directing} className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                    Start over
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-instant/30 bg-surface p-4">
                <p className="min-w-0 flex-1 text-sm text-ink">It looks at your cover and pages, then writes the scenes.</p>
                <Button type="button" onClick={() => direct(false)} loading={directing} disabled={directing} className="bg-instant text-canvas hover:bg-instant/90">
                  <Sparkles className="size-4" aria-hidden /> Direct my ad
                </Button>
              </div>
            )}
            <BookAdPlayer
              spec={spec}
              storyboard={storyboard}
              title={title}
              author={author}
              coverUrl={coverUrl}
              pageUrls={pageUrls}
              settingUrl={storyboard.theme.settingImageUrl}
            />
          </div>

          <fieldset className="order-3">
            <legend className={labelClass}>Font</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {AD_FONTS.map((font) => {
                const selected = storyboard.theme.font === font.key
                return (
                  <button
                    key={font.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTheme({ font: font.key })}
                    style={{ fontFamily: fontFamilies[font.key] }}
                    className={cn(
                      'whitespace-nowrap rounded-xl border px-2 py-2 text-sm text-ink transition',
                      selected ? 'border-instant bg-surface ring-2 ring-instant/30' : 'border-line bg-surface/60 hover:border-instant/50'
                    )}
                  >
                    {font.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="order-4">
            <legend className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Music className="size-3.5" aria-hidden /> Music</span>
            </legend>
            {/* The select gets its own full-width row so a long track name is never clipped. */}
            <div className="mt-1.5 flex flex-col gap-2">
              <select
                aria-label="Music track"
                className={cn(inputClass, 'w-full')}
                value={musicValue}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'none') setMusic({ kind: 'none' })
                  else if (value !== 'upload') setMusic({ kind: 'library', track: value as (typeof MUSIC_TRACKS)[number]['key'] })
                }}
              >
                <option value="none">No music</option>
                {MUSIC_TRACKS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} · {t.composer}
                  </option>
                ))}
                {music.kind === 'upload' && <option value="upload">Your upload: {music.name}</option>}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                {musicUrl(music) && (
                  <button type="button" onClick={togglePreview} aria-label={playing ? 'Pause music preview' : 'Play music preview'} className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-ink transition hover:border-instant/50">
                    {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                  </button>
                )}
                <label className={cn(buttonClasses({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}>
                  <Upload className="size-3.5" aria-hidden /> {uploading ? 'Uploading…' : 'Upload your own'}
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadMusic(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {music.kind === 'library' && <span className="text-xs text-ink-muted">Mood: {music.track}</span>}
              </div>
            </div>
            <audio ref={audioRef} src={musicUrl(music) ?? undefined} onEnded={() => setPlaying(false)} preload="none" />
            <p className="mt-1.5 text-xs text-ink-muted">Bundled tracks are public domain and free to use in ads. Upload only music you have the rights to.</p>
          </fieldset>
          <div className="order-5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Format</span>
              <select className={inputClass} value={spec.format} onChange={(e) => setSpec((s) => ({ ...s, format: e.target.value as AdVideoSpec['format'] }))}>
                {ASPECT_RATIO_OPTIONS.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Length</span>
              <select
                className={inputClass}
                value={spec.length}
                onChange={(e) => {
                  const length = e.target.value as AdVideoSpec['length']
                  setSpec((s) => ({ ...s, length, storyboard: { ...s.storyboard, beats: fitToLength(s.storyboard.beats, getDurationForLength(length)) } }))
                }}
              >
                {LENGTH_OPTIONS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="order-6">
            <legend className={labelClass}>Colours</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    const style = presetStyle(preset.key)
                    setSpec((s) => ({
                      ...s,
                      style,
                      storyboard: { ...s.storyboard, theme: { ...s.storyboard.theme, font: style.font, palette: { bg: style.colors.bgTo, ink: style.colors.text, accent: style.colors.accent } } },
                    }))
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-instant/50"
                >
                  <span className="size-3 rounded-full" style={{ background: preset.palette.accent }} aria-hidden />
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {PALETTE_FIELDS.map((field) => {
                const value = storyboard.theme.palette[field.key]
                return (
                  <label key={field.key} className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
                    {field.label}
                    <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
                      <input
                        type="color"
                        aria-label={`${field.label} colour`}
                        value={HEX.test(value) ? value : '#000000'}
                        onChange={(e) => setTheme({ palette: { ...storyboard.theme.palette, [field.key]: e.target.value } })}
                        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span className="truncate font-mono text-xs text-ink">{value}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className={labelClass}>Effects</span>
              <select aria-label="Effects" className={inputClass} value={storyboard.theme.particles} onChange={(e) => setTheme({ particles: e.target.value as Particle })}>
                {EFFECTS.map((fx) => (
                  <option key={fx.key} value={fx.key}>{fx.label}</option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>

        <div data-column="editor" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <ol className="order-2 flex flex-col gap-3">
            {beats.map((beat, i) => {
              const isEnd = beat.kind === 'endCard'
              const lastBody = beats.length - 2
              return (
                <li key={i} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {i + 1}. {BEAT_LABELS[beat.kind]}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                    {(beat.kind === 'pageZoom' || beat.kind === 'bookOpen' || beat.kind === 'proof') && pageCount > 0 && (
                      <label className="flex items-center">
                        <select
                          aria-label={`Scene ${i + 1} page`}
                          className={cn(inputClass, 'w-auto py-1')}
                          value={beat.page ?? ''}
                          onChange={(e) =>
                            setBeats((b) =>
                              b.map((x, j) => {
                                if (j !== i) return x
                                if (x.kind === 'proof' && e.target.value === '') {
                                  const { page: _drop, ...rest } = x
                                  return rest
                                }
                                return { ...x, page: Number(e.target.value) } as Beat
                              })
                            )
                          }
                        >
                          {beat.kind === 'proof' && <option value="">Cover</option>}
                          {pageOptions.map((p) => (
                            <option key={p} value={p}>Page {p}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs text-ink-muted">
                      <input
                        type="number"
                        step={0.5}
                        min={isEnd ? STORYBOARD_LIMITS.endMinSeconds : STORYBOARD_LIMITS.minSeconds}
                        max={STORYBOARD_LIMITS.maxSeconds}
                        aria-label={`Scene ${i + 1} seconds`}
                        className={cn(inputClass, 'w-16 py-1')}
                        value={beat.seconds}
                        onChange={(e) => setBeat(i, { seconds: Number(e.target.value) })}
                      />
                      s
                    </label>
                    </span>
                    <span className="flex items-center gap-0.5">
                      <button type="button" aria-label={`Move scene ${i + 1} up`} className={iconButton} disabled={isEnd || i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button type="button" aria-label={`Move scene ${i + 1} down`} className={iconButton} disabled={isEnd || i >= lastBody} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove scene ${i + 1}`}
                        className={iconButton}
                        disabled={isEnd || beats.length <= 2}
                        onClick={() => setBeats((b) => b.filter((_, j) => j !== i))}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </span>
                  </div>

                  {beat.kind === 'endCard' ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className={labelClass}>Title <Counter value={beat.title} max={STORYBOARD_LIMITS.title} /></span>
                        <input aria-label="End card title" className={inputClass} value={beat.title} onChange={(e) => setBeat(i, { title: e.target.value })} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={labelClass}>Series or subtitle</span>
                        <input
                          aria-label="End card subtitle"
                          className={inputClass}
                          value={beat.subtitle ?? ''}
                          onChange={(e) => setBeats((b) => b.map((x, j) => (j === i && x.kind === 'endCard' ? { ...x, subtitle: e.target.value || undefined } : x)))}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={labelClass}>Button <Counter value={beat.cta} max={STORYBOARD_LIMITS.cta} /></span>
                        <input aria-label="Button text" className={inputClass} value={beat.cta} onChange={(e) => setBeat(i, { cta: e.target.value })} />
                      </label>
                    </div>
                  ) : (
                    <label className="mt-2 flex flex-col gap-1">
                      <textarea
                        rows={2}
                        aria-label={`Scene ${i + 1} text`}
                        placeholder="Words on screen"
                        className={inputClass}
                        value={beat.text ?? ''}
                        onChange={(e) =>
                          setBeats((b) =>
                            b.map((x, j) => {
                              if (j !== i || x.kind === 'endCard') return x
                              const text = e.target.value
                              if (!text && (x.kind === 'pageZoom' || x.kind === 'bookOpen')) {
                                const { text: _drop, ...rest } = x
                                return rest as Beat
                              }
                              return { ...x, text } as Beat
                            })
                          )
                        }
                      />
                      <span className="self-end"><Counter value={beat.text ?? ''} max={STORYBOARD_LIMITS.text} /></span>
                    </label>
                  )}

                </li>
              )
            })}
          </ol>

        </div>
      </div>
    </section>
  )
}
