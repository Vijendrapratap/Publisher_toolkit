'use client'

import { useState, useEffect } from 'react'
import { Check, Palette, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import {
  TEMPLATES,
  CUSTOM_PALETTE_PRESETS,
  buildCustomPaletteKey,
  parseCustomPalette,
  type TemplatePalette,
} from '@/lib/services/ads/options'

interface CustomPalettePickerProps {
  value: string
  onChange: (templateKey: string) => void
  bookTitle?: string
  coverUrl?: string | null
  badgeText?: string
}

export function CustomPalettePicker({
  value,
  onChange,
  bookTitle = 'Book Title',
  coverUrl,
  badgeText = 'SPECIAL PROMO',
}: CustomPalettePickerProps) {
  const isCustom = value.startsWith('custom')
  const [customPalette, setCustomPalette] = useState<TemplatePalette>(() => parseCustomPalette(value))

  // Sync internal customPalette state if value changes externally
  useEffect(() => {
    if (value.startsWith('custom')) {
      setCustomPalette(parseCustomPalette(value))
    }
  }, [value])

  function handleColorChange(key: keyof TemplatePalette, newColor: string) {
    const updated: TemplatePalette = {
      ...customPalette,
      [key]: newColor,
    }
    setCustomPalette(updated)
    onChange(buildCustomPaletteKey(updated))
  }

  function handleSelectPreset(preset: (typeof CUSTOM_PALETTE_PRESETS)[number]) {
    const updated: TemplatePalette = {
      background: preset.background,
      ink: preset.ink,
      accent: preset.accent,
      secondary: preset.secondary,
    }
    setCustomPalette(updated)
    onChange(buildCustomPaletteKey(updated))
  }

  function handleActivateCustom() {
    onChange(buildCustomPaletteKey(customPalette))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Palette Grid */}
      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {TEMPLATES.map((tpl) => {
          const isSelected = value === tpl.key
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => onChange(tpl.key)}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-accent shadow-inset ring-2 ring-accent/30'
                  : 'border-line/70 bg-surface shadow-subtle hover:border-accent/40'
              )}
            >
              <div
                className="flex h-12 items-center justify-between px-3"
                style={{ background: tpl.palette.background }}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tpl.palette.ink }}>
                  {tpl.key}
                </span>
                <span
                  className="size-3 rounded-full border border-black/20 shadow-sm"
                  style={{ background: tpl.palette.accent }}
                />
              </div>
              <div className="bg-surface p-2.5">
                <p className="truncate text-xs font-semibold text-ink">{tpl.label}</p>
                <p className="line-clamp-1 text-[10px] text-ink-muted">{tpl.description}</p>
              </div>
            </button>
          )
        })}

        {/* CUSTOM PALETTE CARD */}
        <button
          type="button"
          onClick={handleActivateCustom}
          className={cn(
            'group flex flex-col overflow-hidden rounded-xl border text-left transition-all',
            isCustom
              ? 'border-accent shadow-inset ring-2 ring-accent/30'
              : 'border-dashed border-line/90 bg-surface/80 shadow-subtle hover:border-accent/50'
          )}
        >
          <div
            className="flex h-12 items-center justify-between px-3"
            style={{
              background: isCustom
                ? customPalette.background
                : 'linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #0284c7 100%)',
            }}
          >
            <span
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: isCustom ? customPalette.ink : '#ffffff' }}
            >
              <Palette className="size-3.5" aria-hidden />
              Custom
            </span>
            <span
              className="size-3 rounded-full border border-black/20 shadow-sm"
              style={{ background: isCustom ? customPalette.accent : '#38bdf8' }}
            />
          </div>
          <div className="bg-surface p-2.5">
            <p className="truncate text-xs font-semibold text-ink">Custom Palette</p>
            <p className="line-clamp-1 text-[10px] text-ink-muted">Design your own color scheme</p>
          </div>
        </button>
      </div>

      {/* EXPANDABLE CUSTOM PALETTE EDITOR */}
      {isCustom && (
        <div className="rounded-2xl border border-accent/30 bg-surface p-4 sm:p-5 shadow-subtle">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" aria-hidden />
              <h4 className="text-sm font-semibold text-ink">Custom Color Palette Designer</h4>
            </div>
            <span className="text-[11px] text-ink-muted">Pick hex codes or select an inspiration preset</span>
          </div>

          {/* Quick Presets */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Presets:</span>
            {CUSTOM_PALETTE_PRESETS.map((preset) => {
              const active =
                customPalette.background.toLowerCase() === preset.background.toLowerCase() &&
                customPalette.accent.toLowerCase() === preset.accent.toLowerCase()
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                    active
                      ? 'border-accent bg-accent-soft text-ink font-semibold'
                      : 'border-line/70 bg-surface-2/60 text-ink-muted hover:border-accent/40 hover:text-ink'
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ background: preset.accent }} />
                  {preset.name}
                  {active && <Check className="size-3 text-accent" />}
                </button>
              )
            })}
          </div>

          {/* Color Controls + Live Preview */}
          <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-center">
            {/* Color Pickers (8 cols) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-8">
              {/* Background */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-line/70 bg-surface-2/50 p-2.5">
                <label htmlFor="bg-color" className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="bg-color"
                    type="color"
                    value={customPalette.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="size-8 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customPalette.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    maxLength={7}
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Ink / Text */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-line/70 bg-surface-2/50 p-2.5">
                <label htmlFor="ink-color" className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Text / Ink
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="ink-color"
                    type="color"
                    value={customPalette.ink}
                    onChange={(e) => handleColorChange('ink', e.target.value)}
                    className="size-8 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customPalette.ink}
                    onChange={(e) => handleColorChange('ink', e.target.value)}
                    maxLength={7}
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Accent */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-line/70 bg-surface-2/50 p-2.5">
                <label htmlFor="accent-color" className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="accent-color"
                    type="color"
                    value={customPalette.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="size-8 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customPalette.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    maxLength={7}
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Secondary / Border */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-line/70 bg-surface-2/50 p-2.5">
                <label htmlFor="sec-color" className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Border / Secondary
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="sec-color"
                    type="color"
                    value={customPalette.secondary || '#27272a'}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="size-8 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={customPalette.secondary || '#27272a'}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    maxLength={7}
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* Live Card Swatch Mockup (4 cols) */}
            <div className="lg:col-span-4">
              <div
                className="flex items-center gap-3 rounded-xl border p-3 shadow-md transition-colors"
                style={{
                  background: customPalette.background,
                  borderColor: customPalette.secondary || 'rgba(255,255,255,0.15)',
                  color: customPalette.ink,
                }}
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="size-12 rounded object-cover shadow" />
                ) : (
                  <div
                    className="grid size-12 place-items-center rounded text-xs font-bold shadow"
                    style={{ background: customPalette.secondary || '#27272a', color: customPalette.ink }}
                  >
                    Cover
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      border: `1px solid ${customPalette.accent}`,
                      color: customPalette.accent,
                    }}
                  >
                    {badgeText}
                  </span>
                  <p className="truncate text-xs font-semibold mt-1" style={{ color: customPalette.ink }}>
                    {bookTitle}
                  </p>
                  <p className="text-[10px] opacity-80" style={{ color: customPalette.ink }}>
                    Live palette preview
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
