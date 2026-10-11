'use client'
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, ChevronDown, Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import {
  TEMPLATES,
  TONES,
  CAMPAIGN_OBJECTIVES,
  CTA_PRESETS,
  CUSTOM_PALETTE_PRESETS,
  buildCustomPaletteKey,
  getCampaignObjective,
  getTemplate,
  parseCustomPalette,
  type CopyTone,
  type TemplateKey,
  type CampaignObjectiveKey,
  type TemplatePalette,
} from '@/lib/services/ads/options'
import { AdImagePreview, VideoFramePreview } from '@/components/ads/AdPreview'
import { goalSizes, goalWantsVideo } from '@/lib/services/ads/goal'
import { CREDIT_PRICES, adsGenerationAction } from '@/lib/credits/prices'
import { sampleAdCopy } from '@/lib/services/ads/sampleCopy'
import { nextRadioIndex } from '@/lib/ui/radioKeys'
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

/** Short names for the badge chips; the badge text itself is what the ad shows. */
const BADGE_LABELS: Record<string, string> = {
  launch: 'New release',
  preorder: 'Pre-order',
  discount: 'Price drop',
  review_quote: '5-star reviews',
  tropes: 'Reader favourite',
  evergreen: 'Bestseller',
}
const BADGE_CHOICES = CAMPAIGN_OBJECTIVES.filter((o) => o.key !== 'custom')
const SHAPE_LABELS: Record<TrailerAspectRatio, string> = { '9:16': 'Vertical 9:16', '1:1': 'Square 1:1', '16:9': 'Wide 16:9' }
const OWN = '__own__'

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20'

interface Chip<K extends string> {
  key: K
  label: ReactNode
  title?: string
}

/** One-click choices with arrow-key support, shown as a row of chips. */
function ChipGroup<K extends string>({
  label,
  chips,
  value,
  onChange,
}: {
  label: string
  chips: Chip<K>[]
  value: K
  onChange: (key: K) => void
}) {
  const select = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRadioIndex(e.key, index, chips.length)
    if (next === null) return
    e.preventDefault()
    onChange(chips[next].key)
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip, i) => {
        const selected = chip.key === value
        return (
          <button
            key={chip.key}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={chip.title}
            onClick={() => onChange(chip.key)}
            onKeyDown={(e) => select(e, i)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-all',
              selected
                ? 'border-accent bg-accent-soft font-medium text-ink ring-2 ring-accent/25'
                : 'border-line bg-surface text-ink-muted hover:border-accent/50 hover:text-ink'
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

function Section({ step, title, hint, children }: { step?: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        {step !== undefined && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{step}</span>
        )}
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {hint && <span className="text-sm text-ink-muted">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Swatch({ palette }: { palette: TemplatePalette }) {
  return (
    <span className="relative inline-block size-4 rounded-full border border-black/10" style={{ background: palette.background }}>
      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white/60" style={{ background: palette.accent }} />
    </span>
  )
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
  // Amazon is the only platform today; keep whatever the creation already has.
  const platforms: AdPlatform[] = initial.platforms.length > 0 ? initial.platforms : ['AMAZON']
  const [copyTone, setCopyTone] = useState<CopyTone>(initial.copyTone)
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initial.templateKey)
  const [customPalette, setCustomPalette] = useState<TemplatePalette>(() => parseCustomPalette(initial.templateKey))
  const [campaignName, setCampaignName] = useState(initial.campaignName ?? '')
  const [campaignObjective, setCampaignObjective] = useState<CampaignObjectiveKey>(initial.campaignObjective ?? 'launch')
  const [ownBadge, setOwnBadge] = useState(() =>
    (initial.campaignObjective ?? '').startsWith('custom') ? getCampaignObjective(initial.campaignObjective).badge : ''
  )
  const [targetAudience, setTargetAudience] = useState(initial.targetAudience ?? '')
  const [customHook, setCustomHook] = useState(initial.customHook ?? '')
  const [ctaText, setCtaText] = useState(initial.ctaText ?? CTA_PRESETS[0])
  // Once the person picks or writes a button text, changing the badge stops replacing it.
  const [ctaChosen, setCtaChosen] = useState(Boolean(initial.ctaText))
  const [ctaOwn, setCtaOwn] = useState(() => Boolean(initial.ctaText) && !ctaChoices(initial.campaignObjective).includes(initial.ctaText!))

  const [includeVideo, setIncludeVideo] = useState(initial.includeVideo ?? true)
  const [videoFormat, setVideoFormat] = useState<TrailerAspectRatio>(initial.videoFormat ?? '16:9')
  const [videoStyle, setVideoStyle] = useState<TrailerStyle>(initial.videoStyle ?? 'cinematic')
  const [videoMood, setVideoMood] = useState<TrailerMusicMood>(initial.videoMood ?? 'epic')
  const [videoLength, setVideoLength] = useState<TrailerLength>(initial.videoLength ?? '15s')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goal = book.contentGoal ?? 'all'
  const videoOnly = goal === 'video'
  const legacyBundle = goal !== 'video' && goal !== 'aplus' && goal !== 'sponsored'
  const wantsVideo = goalWantsVideo(goal, includeVideo)
  const sizes = goalSizes(goal, platforms)
  const isOwnBadge = campaignObjective.startsWith('custom')
  const badge = getCampaignObjective(campaignObjective).badge
  const palette = getTemplate(templateKey).palette
  const shape = ASPECT_RATIO_OPTIONS.find((a) => a.key === videoFormat) ?? ASPECT_RATIO_OPTIONS[2]
  const headline = sampleAdCopy(book, copyTone, { campaignObjective, customHook: customHook || undefined })[0].headline
  const submitLabel = videoOnly
    ? 'Generate Video Trailer'
    : goal === 'aplus'
      ? 'Generate A+ Content'
      : goal === 'sponsored'
        ? 'Generate Image Ads'
        : 'Generate Amazon Creatives & Video'
  const price = CREDIT_PRICES[adsGenerationAction(book.contentGoal ?? null)]
  const outputSummary = [
    sizes.length > 0 ? `${sizes.length} image ${sizes.length === 1 ? 'size' : 'sizes'}: ${sizes.map((s) => `${s.width}×${s.height}`).join(', ')}` : null,
    wantsVideo ? `a ${videoLength} video` : null,
  ]
    .filter(Boolean)
    .join(' and ')

  function chooseBadge(key: string) {
    if (key === OWN) {
      setCampaignObjective(ownBadge.trim() ? `custom:${encodeURIComponent(ownBadge.trim().toUpperCase())}` : 'custom')
      return
    }
    setCampaignObjective(key)
    if (!ctaChosen) setCtaText(getCampaignObjective(key).defaultCta)
  }

  function writeBadge(text: string) {
    setOwnBadge(text)
    setCampaignObjective(text.trim() ? `custom:${encodeURIComponent(text.trim().toUpperCase())}` : 'custom')
  }

  function chooseCta(key: string) {
    setCtaChosen(true)
    if (key === OWN) return setCtaOwn(true)
    setCtaOwn(false)
    setCtaText(key)
  }

  function chooseStyle(key: string) {
    setTemplateKey(key === 'custom' ? buildCustomPaletteKey(customPalette) : key)
  }

  function changeColour(part: keyof TemplatePalette, colour: string) {
    const next = { ...customPalette, [part]: colour }
    setCustomPalette(next)
    setTemplateKey(buildCustomPaletteKey(next))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms,
        copyTone,
        templateKey,
        campaignName: campaignName.trim() || 'Main Campaign',
        campaignObjective,
        targetAudience: targetAudience.trim() || undefined,
        customHook: customHook.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        includeVideo: wantsVideo,
        videoFormat,
        videoStyle,
        videoMood,
        videoLength,
      }),
    }).catch(() => null)
    if (!res?.ok) {
      setPending(false)
      const message = (await res?.json().catch(() => ({})))?.error ?? 'We couldn’t save your settings.'
      setError(message)
      toast.error(message)
      return
    }
    router.push(`/ads/${projectId}/generate`)
    router.refresh()
  }

  const badgeChips: Chip<string>[] = [
    ...BADGE_CHOICES.map((o) => ({ key: o.key, label: BADGE_LABELS[o.key] ?? o.badge, title: o.badge })),
    { key: OWN, label: <><Pencil className="size-3.5" aria-hidden /> Write your own</> },
  ]
  const ctaChips: Chip<string>[] = [
    ...ctaChoices(campaignObjective, ctaOwn ? undefined : ctaText).map((c) => ({ key: c, label: c })),
    { key: OWN, label: <><Pencil className="size-3.5" aria-hidden /> Write your own</> },
  ]

  const badgeControls = (
    <>
      <ChipGroup label="Badge on the ad" chips={badgeChips} value={isOwnBadge ? OWN : campaignObjective} onChange={chooseBadge} />
      {isOwnBadge && (
        <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium">
          Your badge
          <input className={cn(inputClass, 'uppercase')} value={ownBadge} maxLength={30} onChange={(e) => writeBadge(e.target.value)} placeholder="e.g. Book club pick" />
        </label>
      )}
    </>
  )
  const ctaControls = (
    <>
      <ChipGroup label="Button text" chips={ctaChips} value={ctaOwn ? OWN : ctaText} onChange={chooseCta} />
      {ctaOwn && (
        <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium">
          Your button text
          <input className={inputClass} value={ctaText} maxLength={40} onChange={(e) => setCtaText(e.target.value)} placeholder="e.g. Read it tonight" />
        </label>
      )}
    </>
  )

  let step = 0
  const generateButton = (
    <Button type="submit" size="lg" loading={pending} disabled={pending} className="w-full">
      <Sparkles className="size-4" aria-hidden /> {`${submitLabel} · ${price} credits`}
    </Button>
  )

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]" noValidate>
      <div className="flex flex-col gap-6">
        {generationError && (
          <div role="alert" className="flex items-center gap-3 rounded-card bg-danger/10 p-4 text-sm ring-1 ring-danger/30">
            <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
            <p>
              <span className="font-semibold">Generation didn’t finish.</span> {generationError} Press Generate to try again.
            </p>
          </div>
        )}

        <Card className="flex flex-col gap-8 p-6">
          {!videoOnly && (
            <>
              <Section step={++step} title="Style" hint="Colours and look of your ads">
                <ChipGroup
                  label="Style"
                  value={templateKey.startsWith('custom') ? 'custom' : templateKey}
                  onChange={chooseStyle}
                  chips={[
                    ...TEMPLATES.map((t) => ({ key: t.key as string, label: <><Swatch palette={t.palette} /> {t.label}</>, title: t.description })),
                    { key: 'custom', label: <><Swatch palette={customPalette} /> Your colours</> },
                  ]}
                />
                {templateKey.startsWith('custom') && (
                  <div className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4">
                    <div className="flex flex-wrap gap-4">
                      {(['background', 'ink', 'accent'] as const).map((part) => (
                        <label key={part} className="flex items-center gap-2 text-sm">
                          <input
                            type="color"
                            value={customPalette[part]}
                            onChange={(e) => changeColour(part, e.target.value)}
                            className="size-8 cursor-pointer rounded-md border border-line bg-transparent"
                          />
                          {part === 'background' ? 'Background' : part === 'ink' ? 'Text' : 'Highlight'}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CUSTOM_PALETTE_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            const { name: _name, ...colours } = p
                            setCustomPalette(colours)
                            setTemplateKey(buildCustomPaletteKey(colours))
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs text-ink-muted shadow-subtle hover:text-ink"
                        >
                          <Swatch palette={p} /> {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
              <Section step={++step} title="Badge on the ad">
                {badgeControls}
              </Section>
              <Section step={++step} title="Button text">
                {ctaControls}
              </Section>
            </>
          )}

          {(videoOnly || legacyBundle) && (
            <Section step={++step} title="Video" hint={legacyBundle ? undefined : 'Shape, length and feel'}>
              {legacyBundle && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeVideo} onChange={(e) => setIncludeVideo(e.target.checked)} className="size-4 accent-accent" />
                  Also make a video ad
                </label>
              )}
              {wantsVideo && (
                <div className="flex flex-col gap-4">
                  <span className="-mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Shape</span>
                  <ChipGroup
                    label="Shape"
                    value={videoFormat}
                    onChange={setVideoFormat}
                    chips={ASPECT_RATIO_OPTIONS.map((a) => ({ key: a.key, label: SHAPE_LABELS[a.key], title: a.description }))}
                  />
                  <span className="-mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Length</span>
                  <ChipGroup
                    label="Length"
                    value={videoLength}
                    onChange={setVideoLength}
                    chips={LENGTH_OPTIONS.map((l) => ({ key: l.key, label: `${l.durationSec}s`, title: l.description }))}
                  />
                  <span className="-mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Mood</span>
                  <ChipGroup
                    label="Mood"
                    value={videoMood}
                    onChange={setVideoMood}
                    chips={MUSIC_MOOD_OPTIONS.map((m) => ({ key: m.key, label: m.label, title: m.description }))}
                  />
                  <span className="-mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Motion style</span>
                  <ChipGroup
                    label="Motion style"
                    value={videoStyle}
                    onChange={setVideoStyle}
                    chips={STYLE_OPTIONS.map((s) => ({
                      key: s.key,
                      label: <><Swatch palette={s.palette} /> {s.label}</>,
                      title: s.description,
                    }))}
                  />
                </div>
              )}
            </Section>
          )}

          <Section step={++step} title="Writing tone" hint="For the ad text">
            <ChipGroup
              label="Writing tone"
              value={copyTone}
              onChange={setCopyTone}
              chips={TONES.map((t) => ({ key: t.key, label: t.label, title: t.description }))}
            />
          </Section>

          <details className="group rounded-xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
              More options
              <ChevronDown className="size-4 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="flex flex-col gap-5 border-t border-line px-4 py-4">
              {videoOnly && (
                <>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-medium">Badge</h4>
                    {badgeControls}
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-medium">Button text</h4>
                    {ctaControls}
                  </div>
                </>
              )}
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Headline hook (optional)
                <input className={inputClass} value={customHook} maxLength={200} onChange={(e) => setCustomHook(e.target.value)} placeholder="e.g. The #1 bestselling fantasy of 2026" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Who it’s for (optional)
                <input className={inputClass} value={targetAudience} maxLength={300} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Fans of Brandon Sanderson" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Name for this creation (optional)
                <input className={inputClass} value={campaignName} maxLength={120} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Summer launch" />
              </label>
            </div>
          </details>
        </Card>

        {/* Phones: the button stays in reach at the bottom of the screen. */}
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {generateButton}
        </div>
      </div>

      <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none" aria-label="Preview">
        <Card className="flex flex-col gap-4 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Live preview</h3>
          {videoOnly ? (
            <VideoFramePreview
              width={shape.width}
              height={shape.height}
              palette={STYLE_OPTIONS.find((s) => s.key === videoStyle)?.palette ?? palette}
              coverUrl={book.coverUrl}
              title={book.title || 'Your book'}
              badge={badge}
              caption={`${videoLength.replace('s', ' seconds')} · ${MUSIC_MOOD_OPTIONS.find((m) => m.key === videoMood)?.label} · ${STYLE_OPTIONS.find((s) => s.key === videoStyle)?.label}`}
            />
          ) : (
            <AdImagePreview
              sizes={sizes}
              palette={palette}
              coverUrl={book.coverUrl}
              title={book.title || 'Your book'}
              author={book.author}
              badge={badge}
              ctaText={ctaText}
            />
          )}
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm shadow-inset" aria-live="polite">
            <span className="text-ink-muted">Ad text: </span>
            <span className="font-medium">{headline}</span>
          </div>
          <div className="hidden flex-col gap-2 lg:flex">
            <p className="text-sm text-ink-muted">You’ll get {outputSummary}.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            {generateButton}
          </div>
        </Card>
      </aside>
    </form>
  )
}

/** Button texts to offer: the badge's own suggestion first, then the usual ones, then the current pick if it is neither. */
function ctaChoices(objective?: string | null, current?: string): string[] {
  return [...new Set<string>([getCampaignObjective(objective).defaultCta, ...CTA_PRESETS, ...(current ? [current] : [])])]
}
