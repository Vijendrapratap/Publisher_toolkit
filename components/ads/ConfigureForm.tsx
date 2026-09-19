'use client'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Check, Film, Layers, Palette, Sparkles, Target, Tv, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import {
  PLATFORMS,
  TEMPLATES,
  TONES,
  CAMPAIGN_OBJECTIVES,
  CTA_PRESETS,
  getCampaignObjective,
  type CopyTone,
  type TemplateKey,
  type CampaignObjectiveKey,
} from '@/lib/services/ads/options'
import { CustomPalettePicker } from '@/components/ads/CustomPalettePicker'
import { CustomCampaignPicker } from '@/components/ads/CustomCampaignPicker'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { sampleAdCopy } from '@/lib/services/ads/sampleCopy'
import { nextRadioIndex } from '@/lib/ui/radioKeys'
import { TrailerLivePreviewPlayer } from '@/components/trailer/TrailerLivePreviewPlayer'
import {
  STYLE_OPTIONS,
  MUSIC_MOOD_OPTIONS,
  LENGTH_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  type TrailerStyle,
  type TrailerMusicMood,
  type TrailerLength,
  type TrailerAspectRatio,
} from '@/lib/services/trailer/options'

const sizesFor = (platform: AdPlatform) =>
  CREATIVE_SIZES.filter((s) => s.platform === platform).map((s) => `${s.width}×${s.height}`)

function handleRadioKeyDown<K extends string>(
  e: KeyboardEvent<HTMLButtonElement>,
  keys: readonly K[],
  index: number,
  select: (key: K) => void
) {
  const next = nextRadioIndex(e.key, index, keys.length)
  if (next === null) return
  e.preventDefault()
  select(keys[next])
  const group = e.currentTarget.closest('[role="radiogroup"]')
  const target = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]
  target?.focus()
}

export function ConfigureForm({
  projectId,
  initial,
  book,
  error: generationError,
}: {
  projectId: string
  initial: {
    platforms: AdPlatform[]
    copyTone: CopyTone
    templateKey: TemplateKey
    campaignName?: string | null
    campaignObjective?: string | null
    targetAudience?: string | null
    customHook?: string | null
    ctaText?: string | null
    includeVideo?: boolean
    videoFormat?: TrailerAspectRatio
    videoStyle?: TrailerStyle
    videoMood?: TrailerMusicMood
    videoLength?: TrailerLength
  }
  book: {
    title: string
    author: string
    blurb: string
    coverUrl: string | null
    contentGoal?: string | null
    interiorImageUrls?: string[]
  }
  error?: string
}) {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<AdPlatform[]>(initial.platforms)
  const [copyTone, setCopyTone] = useState<CopyTone>(initial.copyTone)
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initial.templateKey)
  const [campaignName, setCampaignName] = useState(initial.campaignName ?? 'Main Campaign')
  const [campaignObjective, setCampaignObjective] = useState<CampaignObjectiveKey>(
    (initial.campaignObjective as CampaignObjectiveKey) ?? 'launch'
  )
  const [targetAudience, setTargetAudience] = useState(initial.targetAudience ?? '')
  const [customHook, setCustomHook] = useState(initial.customHook ?? '')
  const [ctaText, setCtaText] = useState(initial.ctaText ?? CTA_PRESETS[0])

  const [includeVideo, setIncludeVideo] = useState(
    initial.includeVideo !== undefined
      ? initial.includeVideo
      : book.contentGoal === 'video' || book.contentGoal === 'all'
  )
  const [videoFormat, setVideoFormat] = useState<TrailerAspectRatio>(initial.videoFormat ?? '16:9')
  const [videoStyle, setVideoStyle] = useState<TrailerStyle>(
    (initial.videoStyle as TrailerStyle) || (initial.templateKey as TrailerStyle) || 'cinematic'
  )
  const [videoMood, setVideoMood] = useState<TrailerMusicMood>(initial.videoMood ?? 'epic')
  const [videoLength, setVideoLength] = useState<TrailerLength>(initial.videoLength ?? '15s')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePlatform = (key: AdPlatform) =>
    setPlatforms((current) => (current.includes(key) ? current.filter((p) => p !== key) : [...current, key]))

  const previewHeadline = sampleAdCopy(book, copyTone, {
    campaignObjective,
    customHook: customHook || undefined,
  })[0].headline

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (platforms.length === 0) {
      setError('Choose at least one platform.')
      return
    }
    setPending(true)
    setError(null)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms: PLATFORMS.map((p) => p.key).filter((k) => platforms.includes(k)),
        copyTone,
        templateKey,
        campaignName: campaignName.trim() || 'Main Campaign',
        campaignObjective,
        targetAudience: targetAudience.trim() || undefined,
        customHook: customHook.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        includeVideo,
        videoFormat,
        videoStyle,
        videoMood,
        videoLength,
      }),
    })
    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'We couldn’t save your settings.'
      setError(message)
      toast.error(message)
      return
    }
    router.push(`/ads/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {generationError && (
        <div role="alert" className="flex flex-col gap-3 rounded-card bg-danger/10 p-4 shadow-subtle ring-1 ring-danger/30 sm:flex-row sm:items-center">
          <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Generation didn’t finish.</span> {generationError}
          </p>
          <Button type="submit" variant="danger" size="sm" className="sm:ml-auto" loading={pending}>
            Try again
          </Button>
        </div>
      )}

      {/* Content Goal & Asset Summary Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft/20 p-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-accent" aria-hidden />
          <div className="text-xs">
            <span className="font-semibold text-ink">
              {book.contentGoal === 'aplus'
                ? 'Goal: Amazon KDP A+ Content Suite'
                : book.contentGoal === 'video'
                  ? 'Goal: Amazon Video Trailer'
                  : book.contentGoal === 'sponsored'
                    ? 'Goal: Amazon Sponsored Banners'
                    : 'Goal: Full Amazon Launch Bundle'}
            </span>
            <span className="text-ink-muted ml-2">
              {book.contentGoal === 'aplus'
                ? 'Optimized for 970×600 hero, 970×300 feature, and 300×300 quad modules'
                : book.contentGoal === 'video'
                  ? 'Optimized for 16:9 product page video & 9:16 social shorts'
                  : book.contentGoal === 'sponsored'
                    ? 'Optimized for 300×250 display & 1200×628 headline search banners'
                    : 'A+ Modules + Remotion Video + Sponsored Banners + Copy'}
            </span>
          </div>
        </div>

        {book.interiorImageUrls && book.interiorImageUrls.length > 0 && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-subtle flex items-center gap-1.5 border border-line">
            <Layers className="size-3.5 text-accent" aria-hidden />
            {book.interiorImageUrls.length} interior {book.interiorImageUrls.length === 1 ? 'page' : 'pages'} linked
          </span>
        )}
      </div>

      {/* Campaign Details & Objective */}
      <Card className="p-6">
        <fieldset>
          <div className="flex items-center gap-2">
            <Target className="size-4 text-accent" aria-hidden />
            <legend className="font-display text-lg font-semibold">Campaign Objective & Strategy</legend>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Set the strategic angle, custom promo badge, and goal for this ad campaign.</p>

          <div className="mt-4">
            <label htmlFor="campaignName" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Campaign label
            </label>
            <input
              id="campaignName"
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Summer Release Push"
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="mt-4">
            <CustomCampaignPicker
              campaignObjective={campaignObjective}
              onObjectiveChange={setCampaignObjective}
              campaignName={campaignName}
              onCampaignNameChange={setCampaignName}
              ctaText={ctaText}
              onCtaTextChange={setCtaText}
              bookTitle={book.title || 'Book Title'}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="targetAudience" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Target audience / Comp authors (optional)
              </label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. For fans of Brandon Sanderson & Patrick Rothfuss"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="customHook" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Custom headline hook / Social proof (optional)
              </label>
              <input
                id="customHook"
                type="text"
                value={customHook}
                onChange={(e) => setCustomHook(e.target.value)}
                placeholder="e.g. The #1 Bestselling Fantasy of 2026"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
        </fieldset>
      </Card>

      {/* Platforms Selection */}
      {/* Platforms Selection & Amazon Suite */}
      <Card className="p-6">
        <fieldset>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-accent" aria-hidden />
            <legend className="font-display text-lg font-semibold">Amazon Advertising & KDP A+ Content Suite</legend>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Engineered specifically for Amazon Kindle Direct Publishing (KDP) and Amazon Advertising Console.
          </p>
          <div className="mt-4 grid gap-3">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.key)
              return (
                <div
                  key={p.key}
                  className={cn(
                    'relative flex flex-col gap-3 rounded-2xl border p-5 transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/40 shadow-inset ring-2 ring-accent/20'
                      : 'border-line bg-surface shadow-subtle'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{p.label}</span>
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent">
                          Primary
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{p.description}</p>
                    </div>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => togglePlatform(p.key)}
                      className={cn(
                        'grid size-6 place-items-center rounded-full border transition-colors',
                        selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2'
                      )}
                    >
                      {selected && <Check className="size-3.5" aria-hidden />}
                    </button>
                  </div>

                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-surface/80 p-3 border border-line/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                          Amazon KDP A+ Content Modules
                        </span>
                        <span className="text-[10px] font-mono text-ink-muted">KDP Enhanced</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs text-ink-muted">
                        <li className="flex items-center justify-between">
                          <span>Standard Image Header Banner</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">970×600</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Standard Technical / Feature Banner</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">970×300</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Standard Quad Module / Single Square</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">300×300</span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-surface/80 p-3 border border-line/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                          Amazon Sponsored Ads & Video
                        </span>
                        <span className="text-[10px] font-mono text-ink-muted">AMS Console</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs text-ink-muted">
                        <li className="flex items-center justify-between">
                          <span>Sponsored Display & Lockscreen Ad</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">300×250</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Sponsored Brands Headline Banner</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">1200×628</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Sponsored Brands Video Trailer</span>
                          <span className="font-mono text-[11px] font-semibold text-ink">16:9 HD MP4</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Copy Tone */}
      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Copy tone</legend>
          <div role="radiogroup" aria-label="Copy tone" className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TONES.map((t, i) => {
              const selected = copyTone === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setCopyTone(t.key)}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      TONES.map((tone) => tone.key),
                      i,
                      setCopyTone
                    )
                  }
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-xs text-ink-muted">{t.description}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm shadow-inset" aria-live="polite">
            <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
            <span className="text-ink-muted">Sample headline:</span>
            <span className="font-medium">{previewHeadline}</span>
          </p>
        </fieldset>
      </Card>

      {/* Design Style / Template Selection */}
      <Card className="p-6">
        <fieldset>
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-accent" aria-hidden />
            <legend className="font-display text-lg font-semibold">Design Aesthetic & Color Palette</legend>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Visual palette, custom colors, and typographic treatment for your ad images.</p>
          <div className="mt-4">
            <CustomPalettePicker
              value={templateKey}
              onChange={setTemplateKey}
              bookTitle={book.title || 'Your book'}
              coverUrl={book.coverUrl}
              badgeText={getCampaignObjective(campaignObjective).badge}
            />
          </div>
        </fieldset>
      </Card>

      {/* Amazon Video Trailer & Hyperframes Motion Suite */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
              <Film className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Amazon Sponsored Brands Video Trailer</h3>
              <p className="text-sm text-ink-muted">
                Render a Remotion video trailer with dynamic 3D depth, specular catchlights, kinetic typography, and motion sweeps.
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center gap-2 self-start sm:self-auto">
            <input
              type="checkbox"
              checked={includeVideo}
              onChange={(e) => setIncludeVideo(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            <span className="text-sm font-medium">{includeVideo ? 'Video Enabled' : 'Video Disabled'}</span>
          </label>
        </div>

        {includeVideo && (
          <div className="mt-6 flex flex-col gap-6 border-t border-line/60 pt-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
              <div className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Video Aspect Ratio / Placement
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2.5">
                    {ASPECT_RATIO_OPTIONS.map((asp) => (
                      <button
                        key={asp.key}
                        type="button"
                        onClick={() => setVideoFormat(asp.key)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all',
                          videoFormat === asp.key
                            ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 font-semibold'
                            : 'border-line bg-surface hover:border-accent/40'
                        )}
                      >
                        <span className="text-sm font-semibold">{asp.key}</span>
                        <span className="text-[11px] text-ink-muted leading-tight">
                          {asp.key === '16:9' ? 'Amazon Sponsored (Rec.)' : asp.key === '1:1' ? 'Square Feed' : 'Vertical Reels'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Trailer Length
                    </label>
                    <select
                      value={videoLength}
                      onChange={(e) => setVideoLength(e.target.value as TrailerLength)}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    >
                      {LENGTH_OPTIONS.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.label} ({l.durationSec}s)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Audio Mood & Atmosphere
                    </label>
                    <select
                      value={videoMood}
                      onChange={(e) => setVideoMood(e.target.value as TrailerMusicMood)}
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    >
                      {MUSIC_MOOD_OPTIONS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({m.description})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Visual Cinematics & Motion Style
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STYLE_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setVideoStyle(s.key)}
                        className={cn(
                          'flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-all',
                          videoStyle === s.key
                            ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 font-semibold'
                            : 'border-line bg-surface hover:border-accent/40'
                        )}
                      >
                        <span className="text-xs font-semibold">{s.label}</span>
                        <span className="line-clamp-1 text-[10px] text-ink-muted">{s.tagline}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Remotion Live Preview */}
              <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 shadow-inset">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Remotion Live Preview
                  </span>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    Hyperframes Engine
                  </span>
                </div>
                <div className="grid place-items-center overflow-hidden rounded-xl bg-canvas p-2">
                  <TrailerLivePreviewPlayer
                    title={book.title || 'Untitled Book'}
                    author={book.author || 'Author'}
                    blurb={book.blurb || 'A gripping journey waiting to be discovered.'}
                    hookText={customHook || previewHeadline}
                    ctaText={ctaText}
                    style={videoStyle}
                    musicMood={videoMood}
                    coverUrl={book.coverUrl}
                    defaultAspectRatio={videoFormat}
                    interiorImageUrls={book.interiorImageUrls}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-ink-muted">
          {platforms.length === 0
            ? 'No platforms selected'
            : `${CREATIVE_SIZES.filter((s) => platforms.includes(s.platform)).length} image sizes${includeVideo ? ' + 1 HD video trailer' : ''}`}
        </span>
        <Button type="submit" size="lg" loading={pending} disabled={pending}>
          <Sparkles className="size-4" aria-hidden /> Generate Amazon Creatives & Video
        </Button>
      </div>
    </form>
  )
}
