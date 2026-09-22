'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Film, Music, Pause, Play, Plus, Save, Upload, X, Zap } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { TrailerLivePreviewPlayer } from '@/components/trailer/TrailerLivePreviewPlayer'
import { adFontFamily } from '@/components/trailer/remotion/fonts'
import {
  AD_FONTS,
  MUSIC_TRACKS,
  SCRIPT_LIMITS,
  adVideoSpecSchema,
  musicUrl,
  presetStyle,
  resolveMusic,
  type AdFontKey,
  type AdVideoSpec,
} from '@/lib/services/ads/videoSpec'
import { ASPECT_RATIO_OPTIONS, LENGTH_OPTIONS, STYLE_OPTIONS } from '@/lib/services/trailer/options'

export interface InstantVideoCardProps {
  projectId: string
  title: string
  author: string
  coverUrl: string | null
  interiorImageUrls: string[]
  initialSpec: AdVideoSpec
  video: { videoUrl: string | null; videoPosterUrl: string | null; videoDuration: number | null }
}

const COLOR_FIELDS = [
  { key: 'bgFrom', label: 'Background' },
  { key: 'bgTo', label: 'Background 2' },
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Text' },
] as const

const HEX = /^#[0-9a-f]{6}$/i
const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-instant focus:ring-2 focus:ring-instant/25'
const labelClass = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted'

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('text-[11px] font-normal normal-case tabular-nums', value.length > max ? 'font-semibold text-danger' : 'text-ink-muted')}>
      {value.length}/{max}
    </span>
  )
}

export function InstantVideoCard({ projectId, title, author, coverUrl, interiorImageUrls, initialSpec, video }: InstantVideoCardProps) {
  const [spec, setSpec] = useState(initialSpec)
  const [saved, setSaved] = useState(initialSpec)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [current, setCurrent] = useState(video)
  const [fontFamilies, setFontFamilies] = useState<Partial<Record<AdFontKey, string>>>({})
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const music = resolveMusic(spec)
  const musicValue = music.kind === 'library' ? music.track : music.kind
  const setMusic = (next: NonNullable<AdVideoSpec['music']>) => {
    audioRef.current?.pause()
    setPlaying(false)
    setSpec((s) => ({ ...s, music: next }))
  }

  // Loaded after mount: the font loader needs `document`.
  useEffect(() => {
    setFontFamilies(Object.fromEntries(AD_FONTS.map((f) => [f.key, adFontFamily(f.key)])))
  }, [])

  async function uploadMusic(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/ads/projects/${projectId}/music`, { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) {
      toast.error(body.error ?? 'We couldn’t upload that file.')
      return
    }
    setMusic({ kind: 'upload', url: body.url, name: body.name })
  }

  function togglePreview() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play()
    setPlaying(!playing)
  }

  const dirty = JSON.stringify(spec) !== JSON.stringify(saved)
  const check = adVideoSpecSchema.safeParse(spec)
  const problem = check.success ? null : check.error.issues[0]?.message ?? 'Check the video text'

  const setScript = (patch: Partial<AdVideoSpec['script']>) => setSpec((s) => ({ ...s, script: { ...s.script, ...patch } }))
  const setColors = (patch: Partial<AdVideoSpec['style']['colors']>) =>
    setSpec((s) => ({ ...s, style: { ...s.style, colors: { ...s.style.colors, ...patch } } }))

  async function save(): Promise<boolean> {
    if (!check.success) {
      toast.error(problem ?? 'Check the video text')
      return false
    }
    setSaving(true)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoSpec: check.data }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your video.')
      return false
    }
    setSaved(check.data)
    setSpec(check.data)
    toast.success('Video saved')
    return true
  }

  async function exportVideo() {
    if (dirty && !(await save())) return
    setExporting(true)
    const toastId = toast.loading('Rendering your video…', { description: 'This usually takes under a minute.' })
    const res = await fetch(`/api/ads/projects/${projectId}/video/instant`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setExporting(false)
    if (!res.ok) {
      toast.error('Export failed', { id: toastId, description: json.error })
      return
    }
    setCurrent(json)
    toast.success('Your video is ready', { id: toastId, description: 'Download it below the title.' })
  }

  return (
    <section aria-labelledby="instant-video-title" className="rounded-3xl border border-instant/30 bg-instant-soft p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-instant text-canvas">
            <Zap className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id="instant-video-title" className="font-display text-lg font-semibold text-ink">Instant Video</h3>
            <p className="text-sm text-ink-muted">Edit the words, font and colours. The preview updates as you type.</p>
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
            <Film className="size-3.5" aria-hidden /> Save &amp; export MP4
          </Button>
        </div>
      </header>

      {problem && dirty && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{problem}</p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
        {/*
          `contents` below `lg` lets these children join the parent grid's own flow, so `order-*`
          (below) can interleave them with the editor column's children into the brief's mobile
          stacking order; `lg:flex lg:flex-col` restores this as a real sticky column at `lg`, where
          the same order values (ascending within each column) reproduce today's lg layout unchanged.
        */}
        <div data-column="preview" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:sticky lg:top-24 lg:self-start">
          <TrailerLivePreviewPlayer
            spec={spec}
            title={title}
            author={author}
            coverUrl={coverUrl}
            interiorImageUrls={interiorImageUrls}
            className="order-1"
          />

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
              <select className={inputClass} value={spec.length} onChange={(e) => setSpec((s) => ({ ...s, length: e.target.value as AdVideoSpec['length'] }))}>
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
                  onClick={() => setSpec((s) => ({ ...s, style: presetStyle(preset.key) }))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-instant/50"
                >
                  <span className="size-3 rounded-full" style={{ background: preset.palette.accent }} aria-hidden />
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map((field) => {
                const value = spec.style.colors[field.key]
                return (
                  <label key={field.key} className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
                    {field.label}
                    <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
                      <input
                        type="color"
                        aria-label={`${field.label} colour`}
                        value={HEX.test(value) ? value : '#000000'}
                        onChange={(e) => setColors({ [field.key]: e.target.value })}
                        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <input
                        aria-label={`${field.label} hex`}
                        value={value}
                        onChange={(e) => setColors({ [field.key]: e.target.value })}
                        className="w-full min-w-0 bg-transparent font-mono text-xs text-ink outline-none"
                      />
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>

        <div data-column="editor" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <label className="order-2 flex flex-col gap-1.5">
            <span className={labelClass}>Hook <Counter value={spec.script.hook} max={SCRIPT_LIMITS.hook} /></span>
            <input className={inputClass} value={spec.script.hook} onChange={(e) => setScript({ hook: e.target.value })} />
          </label>

          <label className="order-2 flex flex-col gap-1.5">
            <span className={labelClass}>Story line <Counter value={spec.script.storyLine} max={SCRIPT_LIMITS.storyLine} /></span>
            <textarea rows={2} className={inputClass} value={spec.script.storyLine} onChange={(e) => setScript({ storyLine: e.target.value })} />
          </label>

          <div className="order-2 flex flex-col gap-1.5">
            <span className={labelClass}>Benefits <span className="font-normal normal-case">up to {SCRIPT_LIMITS.benefits}</span></span>
            {spec.script.benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Benefit ${i + 1}`}
                  className={inputClass}
                  value={benefit}
                  onChange={(e) => setScript({ benefits: spec.script.benefits.map((b, j) => (j === i ? e.target.value : b)) })}
                />
                <Counter value={benefit} max={SCRIPT_LIMITS.benefit} />
                <button
                  type="button"
                  aria-label={`Remove benefit ${i + 1}`}
                  onClick={() => setScript({ benefits: spec.script.benefits.filter((_, j) => j !== i) })}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-surface hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {spec.script.benefits.length < SCRIPT_LIMITS.benefits && (
              <button
                type="button"
                onClick={() => setScript({ benefits: [...spec.script.benefits, ''] })}
                className="inline-flex items-center gap-1 self-start text-sm font-medium text-instant hover:underline"
              >
                <Plus className="size-3.5" aria-hidden /> Add a benefit
              </button>
            )}
          </div>

          <label className="order-2 flex flex-col gap-1.5">
            <span className={labelClass}>Call to action <Counter value={spec.script.cta} max={SCRIPT_LIMITS.cta} /></span>
            <input className={inputClass} value={spec.script.cta} onChange={(e) => setScript({ cta: e.target.value })} />
          </label>

          <fieldset className="order-3">
            <legend className={labelClass}>Font</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {AD_FONTS.map((font) => {
                const selected = spec.style.font === font.key
                return (
                  <button
                    key={font.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSpec((s) => ({ ...s, style: { ...s.style, font: font.key } }))}
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
            {/* The select gets its own full-width row: sharing a row with the play/upload buttons
                left too little width for a track name to render without the browser clipping it
                (native <select> text rendering isn't caught by a scrollWidth check). */}
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
                {music.kind === 'library' && (
                  <span className="text-xs text-ink-muted">Mood: {music.track}</span>
                )}
              </div>
            </div>
            <audio ref={audioRef} src={musicUrl(music) ?? undefined} onEnded={() => setPlaying(false)} preload="none" />
            <p className="mt-1.5 text-xs text-ink-muted">Bundled tracks are public domain and free to use in ads. Upload only music you have the rights to.</p>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
