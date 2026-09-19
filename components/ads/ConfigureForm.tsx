'use client'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Check, Palette, Sparkles, Target } from 'lucide-react'
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
  type CopyTone,
  type TemplateKey,
  type CampaignObjectiveKey,
} from '@/lib/services/ads/options'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { sampleAdCopy } from '@/lib/services/ads/sampleCopy'
import { nextRadioIndex } from '@/lib/ui/radioKeys'

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
  }
  book: { title: string; author: string; blurb: string; coverUrl: string | null }
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

      {/* Campaign Details & Objective */}
      <Card className="p-6">
        <fieldset>
          <div className="flex items-center gap-2">
            <Target className="size-4 text-accent" aria-hidden />
            <legend className="font-display text-lg font-semibold">Campaign objective & goal</legend>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Set the strategic angle and goal for this ad campaign.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {CAMPAIGN_OBJECTIVES.map((obj) => {
              const selected = campaignObjective === obj.key
              return (
                <button
                  key={obj.key}
                  type="button"
                  onClick={() => {
                    setCampaignObjective(obj.key)
                    if (!ctaText || CTA_PRESETS.includes(ctaText as any)) {
                      setCtaText(obj.defaultCta)
                    }
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="text-xs font-bold text-accent">{obj.badge}</span>
                  <span className="font-semibold">{obj.label}</span>
                  <span className="text-xs text-ink-muted">{obj.description}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
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

            <div>
              <label htmlFor="ctaText" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Primary Call to Action (CTA)
              </label>
              <select
                id="ctaText"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {CTA_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
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
      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Where will these ads run?</legend>
          <p className="text-sm text-ink-muted">We’ll make every size each platform needs.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => togglePlatform(p.key)}
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
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs text-ink-muted">{p.description}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {sizesFor(p.key).map((s) => (
                      <span key={s} className="rounded-md bg-surface-2/80 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{s}</span>
                    ))}
                  </span>
                </button>
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
            <legend className="font-display text-lg font-semibold">Design aesthetic & style</legend>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Visual palette and typographic treatment for your ad images.</p>
          <div role="radiogroup" aria-label="Design template" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t, i) => {
              const selected = templateKey === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTemplateKey(t.key)}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      TEMPLATES.map((tpl) => tpl.key),
                      i,
                      setTemplateKey
                    )
                  }
                  className={cn(
                    'flex flex-col overflow-hidden rounded-2xl border border-transparent text-left transition-all',
                    selected ? 'border-accent shadow-inset ring-2 ring-accent/30' : 'shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span
                    className="flex aspect-video flex-col items-center justify-center gap-2 p-4"
                    style={{ background: t.palette.background, color: t.palette.ink }}
                    aria-hidden
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={book.coverUrl} alt="" className="h-2/3 rounded-md object-cover shadow-lg" />
                    ) : (
                      <span className="h-2/3 w-1/3 rounded-md bg-current opacity-20" />
                    )}
                    <span className="line-clamp-1 font-display text-xs font-semibold">{book.title || 'Your book'}</span>
                    <span className="h-0.5 w-8" style={{ background: t.palette.accent }} />
                  </span>
                  <span className="flex flex-col gap-0.5 bg-surface p-3">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-xs text-ink-muted">{t.description}</span>
                  </span>
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
          {platforms.length === 0
            ? 'No platforms selected'
            : `${CREATIVE_SIZES.filter((s) => platforms.includes(s.platform)).length} ad sizes`}
        </span>
        <Button type="submit" size="lg" loading={pending} disabled={platforms.length === 0}>
          <Sparkles className="size-4" aria-hidden /> Generate creatives
        </Button>
      </div>
    </form>
  )
}
