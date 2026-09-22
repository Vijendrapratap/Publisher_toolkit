'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sliders,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Save,
  Palette,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  RefreshCw,
} from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'brand' | 'retail' | 'ai'>('brand')
  const [saving, setSaving] = useState(false)

  // OpenRouter key state
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [aiConfigured, setAiConfigured] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)

  useEffect(() => {
    fetch('/api/settings/ai-key')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setAiConfigured(Boolean(data.isConfigured))
          if (data.maskedKey) setMaskedKey(data.maskedKey)
        }
      })
      .catch(() => {})
  }, [])

  const handleTestAiKey = async () => {
    if (!openRouterKey.trim()) {
      toast.error('Please enter an OpenRouter API key to test')
      return
    }
    setTestingAi(true)
    try {
      const res = await fetch('/api/settings/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openRouterKey, testOnly: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      toast.success('AI Connection Successful!', {
        description: 'Your API key is valid and ready to generate book content.',
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify API key')
    } finally {
      setTestingAi(false)
    }
  }

  const handleSaveAiKey = async () => {
    if (!openRouterKey.trim()) {
      toast.error('Please enter an API key')
      return
    }
    setSavingAi(true)
    try {
      const res = await fetch('/api/settings/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openRouterKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setAiConfigured(true)
      setMaskedKey(`${openRouterKey.trim().slice(0, 7)}...${openRouterKey.trim().slice(-4)}`)
      setOpenRouterKey('')
      toast.success('API Key Saved!', {
        description: 'Your custom AI account is now active.',
      })
    } catch (err: any) {
      toast.error(err.message || 'Could not save API key')
    } finally {
      setSavingAi(false)
    }
  }

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
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'ai'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          )}
        >
          <Sparkles className="size-4" />
          AI Engine (Optional)
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

      {/* TAB 3: AI CONNECTION (OPTIONAL) */}
      {activeTab === 'ai' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  <h2 className="font-display text-lg font-semibold text-ink">AI Assistant Configuration</h2>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Connect your OpenRouter account for custom AI copywriting, or use the built-in system out of the box.
                </p>
              </div>
              <Badge tone={aiConfigured ? 'success' : 'neutral'} className="gap-1.5">
                <span className={cn('size-2 rounded-full', aiConfigured ? 'bg-success animate-pulse' : 'bg-ink-muted')} />
                {aiConfigured ? 'Custom Key Active' : 'Standard Engine Active'}
              </Badge>
            </div>

            {maskedKey && (
              <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Key className="size-4 text-accent" />
                  <span className="text-ink-muted">Saved API Key:</span>
                  <code className="font-mono text-ink font-semibold">{maskedKey}</code>
                </div>
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Connected
                </span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="openRouterKey" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {maskedKey ? 'Update API Key' : 'OpenRouter API Key'}
                </label>
                <div className="relative mt-1.5">
                  <Key className="absolute left-3.5 top-3 size-4 text-ink-muted" aria-hidden />
                  <input
                    id="openRouterKey"
                    type={showKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-10 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 rounded p-1 text-ink-muted hover:text-ink"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  Optional. You can get an API key from{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    openrouter.ai/keys
                  </a>
                  .
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  loading={testingAi}
                  disabled={!openRouterKey.trim() || savingAi}
                  onClick={handleTestAiKey}
                >
                  <RefreshCw className="size-3.5" /> Test Connection
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={savingAi}
                  disabled={!openRouterKey.trim() || testingAi}
                  onClick={handleSaveAiKey}
                >
                  <Save className="size-3.5" /> Save Key
                </Button>
              </div>
            </div>

            <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-muted">
              <ShieldCheck className="size-4 shrink-0 text-success mt-0.5" />
              <span>
                Your API key is securely stored in your workspace and used solely to generate book content and marketing copy.
              </span>
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
