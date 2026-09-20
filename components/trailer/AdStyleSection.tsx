'use client'

import { Plus, Sparkles, Star, Trash2, Wand2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import { AD_PRESETS } from '@/lib/services/videoad/presets'

export interface AdStyleValue {
  preset: string
  headline: string
  benefits: string[]
  ctaText: string
  aiScene: boolean
  showProof: boolean
}

/** Whatever the listing gave us, so the proof beat can be offered honestly. */
export interface ProofFacts {
  rating?: number | null
  reviewCount?: number | null
  price?: string | null
}

const MAX_BENEFITS = 4

export function AdStyleSection({
  value,
  onChange,
  proof,
  aiConfigured,
}: {
  value: AdStyleValue
  onChange: (next: AdStyleValue) => void
  proof: ProofFacts
  aiConfigured: boolean
}) {
  const set = <K extends keyof AdStyleValue>(key: K, next: AdStyleValue[K]) =>
    onChange({ ...value, [key]: next })

  const setBenefit = (index: number, text: string) =>
    set('benefits', value.benefits.map((b, i) => (i === index ? text : b)))

  const hasProof = Boolean(proof.rating || proof.reviewCount || proof.price)

  return (
    <>
      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Wand2 className="size-5 text-accent" aria-hidden /> Ad style
          </legend>
          <p className="mt-1 text-sm text-ink-muted">
            Sets the palette, the layout and how the claims are worded. Pick the one that matches
            what you are selling, not the prettiest.
          </p>

          <div role="radiogroup" aria-label="Ad style" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {AD_PRESETS.map((preset) => {
              const selected = value.preset === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => set('preset', preset.key)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-2xl border border-transparent p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 shadow-inset ring-2 ring-accent/30'
                      : 'bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span
                    className="h-10 w-full rounded-lg shadow-inset"
                    style={{
                      background: `linear-gradient(120deg, ${preset.palette.background[0]}, ${preset.palette.background[1]})`,
                    }}
                    aria-hidden
                  />
                  <span className="font-semibold">{preset.label}</span>
                  <span className="text-xs text-ink-muted">{preset.description}</span>
                  <span className="text-[11px] text-ink-muted">{preset.bestFor.join(' · ')}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="size-5 text-accent" aria-hidden /> What the ad says
          </legend>
          <p className="mt-1 text-sm text-ink-muted">
            These ads play muted in a small tile, so the text is the whole message. Leave a field
            blank and it will be written from your book&rsquo;s listing.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Headline <span className="text-ink-muted">— the single strongest reason to buy</span>
              </span>
              <Input
                value={value.headline}
                maxLength={70}
                placeholder="2,000 words with solutions included"
                onChange={(e) => set('headline', e.target.value)}
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                Benefit lines <span className="text-ink-muted">— 2 to 4 words each</span>
              </span>
              {value.benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={benefit}
                    maxLength={40}
                    placeholder="EXTRA LARGE PRINT"
                    onChange={(e) => setBenefit(index, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => set('benefits', value.benefits.filter((_, i) => i !== index))}
                    aria-label={`Remove benefit ${index + 1}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {value.benefits.length < MAX_BENEFITS && (
                <button
                  type="button"
                  onClick={() => set('benefits', [...value.benefits, ''])}
                  className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  <Plus className="size-4" aria-hidden /> Add a benefit
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Call to action</span>
              <Input
                value={value.ctaText}
                maxLength={40}
                placeholder="GET YOUR COPY TODAY"
                onChange={(e) => set('ctaText', e.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Finishing options</legend>

          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-subtle">
            <input
              type="checkbox"
              checked={value.aiScene}
              disabled={!aiConfigured}
              onChange={(e) => set('aiScene', e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Photographic background</span>
              <span className="text-xs text-ink-muted">
                {aiConfigured
                  ? 'Generates a real photo scene behind your cover instead of the designed wash. Adds about ten seconds per ad.'
                  : 'Add an OpenRouter key in Settings to generate photo backgrounds.'}
              </span>
            </span>
          </label>

          <label
            className={cn(
              'mt-3 flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-subtle',
              !hasProof && 'opacity-60'
            )}
          >
            <input
              type="checkbox"
              checked={value.showProof && hasProof}
              disabled={!hasProof}
              onChange={(e) => set('showProof', e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Star className="size-3.5 text-accent" aria-hidden /> Show rating and price
              </span>
              <span className="text-xs text-ink-muted">
                {hasProof
                  ? [
                      proof.rating ? `${proof.rating} stars` : null,
                      proof.reviewCount ? `${proof.reviewCount.toLocaleString()} ratings` : null,
                      proof.price,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'No rating or price was imported, so there is nothing to show.'}
              </span>
            </span>
          </label>
        </fieldset>
      </Card>
    </>
  )
}
