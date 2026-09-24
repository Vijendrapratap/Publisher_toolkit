'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Sliders, ShoppingBag, Save, Palette, Check } from 'lucide-react'
import type { RedactedPublisherSettings } from '@/lib/publisher/settings'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea, Field } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'

const AVAILABLE_GENRES = [
  'Literary Fiction',
  'Sci-Fi & Fantasy',
  'Mystery & Thriller',
  'Romance',
  'Historical Fiction',
  'Non-Fiction & Memoir',
  'Young Adult',
  'Horror & Dark Fiction',
  'Children’s Books',
  'Poetry',
  'Business & Self-Help',
]

export function SettingsForm({ initial }: { initial: RedactedPublisherSettings }) {
  const [settings, setSettings] = useState<RedactedPublisherSettings>(initial)
  const [activeTab, setActiveTab] = useState<'brand' | 'retail'>('brand')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/publisher/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setSettings(updated)
      try {
        localStorage.setItem('pt_studio_name', updated.brand.name)
      } catch {}
      toast.success('Publisher profile settings saved!')
    } catch {
      toast.error('Could not save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleGenre = (genre: string) => {
    const current = settings.brand.primaryGenres || []
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre]
    setSettings((prev) => ({
      ...prev,
      brand: { ...prev.brand, primaryGenres: next },
    }))
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent shadow-subtle">
              <Sliders className="size-5" />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Studio Profile & Settings
            </h1>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Manage your publishing imprint, brand colors, retail links, and writing style.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" loading={saving} onClick={handleSave}>
            <Save className="size-4" /> Save Settings
          </Button>
        </div>
      </div>

      {/* Publisher Imprint Identity Summary Card */}
      <Card className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-lg font-bold text-on-accent shadow-subtle">
            {settings.brand.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('') || 'LP'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-ink">{settings.brand.name}</span>
              <Badge tone="success" className="gap-1 text-xs">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Active Imprint
              </Badge>
            </div>
            <p className="text-xs text-ink-muted">{settings.brand.tagline || 'Independent Publishing Imprint'}</p>
          </div>
        </div>
      </Card>

      {/* Clean Tabs Navigation */}
      <div className="flex gap-2 border-b border-line pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('brand')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'brand'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          )}
        >
          <Palette className="size-4" />
          Brand & Imprint
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('retail')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'retail'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          )}
        >
          <ShoppingBag className="size-4" />
          Store & Buy Links
        </button>
      </div>

      {/* TAB 1: BRAND & IMPRINT */}
      {activeTab === 'brand' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-6 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Imprint Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Publisher or Imprint Name" htmlFor="brand-name">
                <Input
                  id="brand-name"
                  value={settings.brand.name}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      brand: { ...prev.brand, name: e.target.value },
                    }))
                  }
                  placeholder="e.g. Meridian Press"
                />
              </Field>

              <Field label="Tagline or Imprint Mission" htmlFor="brand-tagline">
                <Input
                  id="brand-tagline"
                  value={settings.brand.tagline}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      brand: { ...prev.brand, tagline: e.target.value },
                    }))
                  }
                  placeholder="e.g. Independent Speculative Fiction"
                />
              </Field>
            </div>

            {/* Brand Colors */}
            <div>
              <label className="text-sm font-medium text-ink">Brand Palette</label>
              <p className="text-xs text-ink-muted">Used automatically for ad banners, cover layouts, and book illustrations.</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 shadow-inset">
                  <input
                    type="color"
                    id="primary-color"
                    value={settings.brand.primaryColor}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        brand: { ...prev.brand, primaryColor: e.target.value },
                      }))
                    }
                    className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-semibold text-ink">Primary Color</span>
                    <span className="font-mono text-[11px] text-ink-muted">{settings.brand.primaryColor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 shadow-inset">
                  <input
                    type="color"
                    id="accent-color"
                    value={settings.brand.accentColor}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        brand: { ...prev.brand, accentColor: e.target.value },
                      }))
                    }
                    className="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-semibold text-ink">Accent Highlight</span>
                    <span className="font-mono text-[11px] text-ink-muted">{settings.brand.accentColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Genres */}
            <div>
              <label className="text-sm font-medium text-ink">Catalog Genres & Specialties</label>
              <p className="text-xs text-ink-muted">Tailors default ad copy angles and reader audience presets.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {AVAILABLE_GENRES.map((genre) => {
                  const selected = (settings.brand.primaryGenres || []).includes(genre)
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                        selected
                          ? 'bg-accent text-on-accent shadow-subtle'
                          : 'bg-surface-2 text-ink-muted hover:bg-surface-2/80 hover:text-ink'
                      )}
                    >
                      {selected && <Check className="mr-1 inline-block size-3" />}
                      {genre}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Voice Guidelines */}
            <Field
              label="Editorial Voice & Style Guidelines"
              htmlFor="voice-prompt"
              hint="Guides tone and character descriptions across marketing copy and book generation."
            >
              <Textarea
                id="voice-prompt"
                value={settings.brand.voicePrompt}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    brand: { ...prev.brand, voicePrompt: e.target.value },
                  }))
                }
                rows={3}
                placeholder="Atmospheric, intelligent, and narrative-driven. Emphasize emotional stakes..."
              />
            </Field>
          </Card>
        </div>
      )}

      {/* TAB 2: STORE & BUY LINKS */}
      {activeTab === 'retail' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Store & Retail Links</h2>
              <p className="text-xs text-ink-muted">
                These links are automatically attached to your promotional buttons, ads, and generated web pages.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amazon Author / KDP Storefront URL" htmlFor="retail-amazon">
                <Input
                  id="retail-amazon"
                  value={settings.retail.amazonUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retail: { ...prev.retail, amazonUrl: e.target.value },
                    }))
                  }
                  placeholder="https://amazon.com/author/yourstudio"
                />
              </Field>

              <Field label="Bookshop.org Storefront URL" htmlFor="retail-bookshop" hint="For independent bookstore sales">
                <Input
                  id="retail-bookshop"
                  value={settings.retail.bookshopUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retail: { ...prev.retail, bookshopUrl: e.target.value },
                    }))
                  }
                  placeholder="https://bookshop.org/shop/yourstudio"
                />
              </Field>

              <Field label="Direct Bookstore (Shopify / Web)" htmlFor="retail-direct">
                <Input
                  id="retail-direct"
                  value={settings.retail.directStoreUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retail: { ...prev.retail, directStoreUrl: e.target.value },
                    }))
                  }
                  placeholder="https://yourimprint.com/shop"
                />
              </Field>

              <Field label="Amazon Associates / Tag" htmlFor="retail-affiliate" hint="Appended to Amazon links for affiliate attribution">
                <Input
                  id="retail-affiliate"
                  value={settings.retail.affiliateTag || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retail: { ...prev.retail, affiliateTag: e.target.value },
                    }))
                  }
                  placeholder="yourtag-20"
                />
              </Field>
            </div>
          </Card>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between border-t border-line pt-6">
        <Link href="/" className="text-xs text-ink-muted hover:text-accent">
          ← Return to Tool Hub
        </Link>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          <Save className="size-4" /> Save Settings
        </Button>
      </div>
    </div>
  )
}
