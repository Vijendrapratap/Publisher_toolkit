'use client'

import { useState, useEffect } from 'react'
import { Check, Sparkles, Target } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import {
  CAMPAIGN_OBJECTIVES,
  CUSTOM_BADGE_PRESETS,
  CTA_PRESETS,
} from '@/lib/services/ads/options'

interface CustomCampaignPickerProps {
  campaignObjective: string
  onObjectiveChange: (objective: string) => void
  campaignName: string
  onCampaignNameChange: (name: string) => void
  ctaText: string
  onCtaTextChange: (cta: string) => void
  bookTitle?: string
}

export function CustomCampaignPicker({
  campaignObjective,
  onObjectiveChange,
  campaignName,
  onCampaignNameChange,
  ctaText,
  onCtaTextChange,
  bookTitle = '',
}: CustomCampaignPickerProps) {
  const isCustom = campaignObjective.startsWith('custom')

  // Extract initial custom badge if formatted as custom:BADGE_NAME
  const initialCustomBadge = isCustom && campaignObjective.includes(':')
    ? decodeURIComponent(campaignObjective.split(':')[1])
    : 'SPECIAL PROMO'

  const [customBadge, setCustomBadge] = useState(initialCustomBadge)

  useEffect(() => {
    if (campaignObjective.startsWith('custom')) {
      if (campaignObjective.includes(':')) {
        setCustomBadge(decodeURIComponent(campaignObjective.split(':')[1]))
      }
    }
  }, [campaignObjective])

  function handleSelectObjective(key: string, defaultCta: string) {
    if (key === 'custom') {
      const activeBadge = customBadge.trim() || 'SPECIAL PROMO'
      onObjectiveChange(`custom:${encodeURIComponent(activeBadge)}`)
      if (!ctaText) onCtaTextChange(defaultCta)
    } else {
      onObjectiveChange(key)
      onCtaTextChange(defaultCta)
    }
  }

  function handleBadgeChange(newBadge: string) {
    setCustomBadge(newBadge)
    const trimmed = newBadge.trim()
    onObjectiveChange(trimmed ? `custom:${encodeURIComponent(trimmed.toUpperCase())}` : 'custom')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Objective Cards Grid */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPAIGN_OBJECTIVES.map((obj) => {
          const isSelected = isCustom ? obj.key === 'custom' : campaignObjective === obj.key
          return (
            <button
              key={obj.key}
              type="button"
              onClick={() => handleSelectObjective(obj.key, obj.defaultCta)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all',
                isSelected
                  ? 'border-accent bg-accent-soft/80 shadow-inset ring-2 ring-accent/30'
                  : 'border-line/70 bg-surface shadow-subtle hover:border-accent/40 hover:bg-surface-2/40'
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                {obj.key === 'custom' && isCustom && customBadge.trim() ? customBadge.toUpperCase() : obj.badge}
              </span>
              <span className="text-xs font-semibold text-ink">{obj.label}</span>
              <span className="line-clamp-2 text-[11px] text-ink-muted leading-relaxed">{obj.description}</span>
            </button>
          )
        })}
      </div>

      {/* EXPANDABLE CUSTOM CAMPAIGN CONTROLS */}
      {isCustom && (
        <div className="rounded-2xl border border-accent/30 bg-surface p-4 sm:p-5 shadow-subtle">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <h4 className="text-sm font-semibold text-ink">Custom Campaign Builder</h4>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            Define your unique promotional badge and call-to-action text for maximum conversion.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Custom Promotional Badge */}
            <div>
              <label htmlFor="customBadgeInput" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Promotional Badge Tag (printed on banners)
              </label>
              <input
                id="customBadgeInput"
                type="text"
                value={customBadge}
                onChange={(e) => handleBadgeChange(e.target.value)}
                maxLength={24}
                placeholder="e.g. STAFF PICK, 50% OFF, EDITORS CHOICE"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />

              {/* Quick Badge Presets */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-ink-muted">Suggestions:</span>
                {CUSTOM_BADGE_PRESETS.map((badge) => {
                  const active = customBadge.toUpperCase() === badge
                  return (
                    <button
                      key={badge}
                      type="button"
                      onClick={() => handleBadgeChange(badge)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        active
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-line/70 bg-surface-2/60 text-ink-muted hover:border-accent/40 hover:text-ink'
                      )}
                    >
                      {badge}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Campaign Label & Custom CTA */}
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="customCtaInput" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Call to Action (CTA)
                </label>
                <input
                  id="customCtaInput"
                  type="text"
                  value={ctaText}
                  onChange={(e) => onCtaTextChange(e.target.value)}
                  placeholder="e.g. Order Your Copy Today"
                  maxLength={60}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />

                {/* Quick CTA Presets */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium text-ink-muted">Presets:</span>
                  {CTA_PRESETS.slice(0, 4).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onCtaTextChange(preset)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] transition-colors',
                        ctaText === preset
                          ? 'border-accent bg-accent-soft text-ink font-semibold'
                          : 'border-line/70 bg-surface-2/60 text-ink-muted hover:border-accent/40 hover:text-ink'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
