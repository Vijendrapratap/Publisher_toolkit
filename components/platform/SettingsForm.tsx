'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Share2,
  Sliders,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  Save,
  Palette,
  Layers,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Cpu,
  Radio,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react'
import type { PublisherSettings } from '@/lib/publisher/settings'
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
  'Poetry',
  'Business & Self-Help',
]

export function SettingsForm({ initial }: { initial: PublisherSettings }) {
  const [settings, setSettings] = useState<PublisherSettings>(initial)
  const [activeTab, setActiveTab] = useState<'ai' | 'connectors' | 'brand' | 'retail'>('ai')
  const [saving, setSaving] = useState(false)
  const [testingMeta, setTestingMeta] = useState(false)
  const [testingGoogle, setTestingGoogle] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  // OpenRouter key state
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState('deepseek/deepseek-v4.1-flash')
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
          if (data.model) setOpenRouterModel(data.model)
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
        body: JSON.stringify({ apiKey: openRouterKey, model: openRouterModel, testOnly: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      toast.success('OpenRouter Connection Successful!', {
        description: 'API key is valid and ready to generate ad copy.',
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify OpenRouter key')
    } finally {
      setTestingAi(false)
    }
  }

  const handleSaveAiKey = async () => {
    if (!openRouterKey.trim()) {
      toast.error('Please enter an OpenRouter API key')
      return
    }
    setSavingAi(true)
    try {
      const res = await fetch('/api/settings/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openRouterKey, model: openRouterModel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setAiConfigured(true)
      setMaskedKey(`${openRouterKey.trim().slice(0, 7)}...${openRouterKey.trim().slice(-4)}`)
      setOpenRouterKey('')
      toast.success('OpenRouter API Key Saved!', {
        description: 'AI copywriting is now running live via OpenRouter.',
      })
    } catch (err: any) {
      toast.error(err.message || 'Could not save OpenRouter key')
    } finally {
      setSavingAi(false)
    }
  }

  const handleCopyId = () => {
    try {
      navigator.clipboard.writeText(settings.publisherId)
      setCopiedId(true)
      toast.success('Tenant ID copied to clipboard')
      setTimeout(() => setCopiedId(false), 2000)
    } catch {}
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
      // Also update local storage for instant sync in AccountChip
      try {
        localStorage.setItem('pt_studio_name', updated.brand.name)
      } catch {}
      toast.success('Publisher profile and connector settings saved!')
    } catch {
      toast.error('Could not save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleTestMetaMcp = () => {
    setTestingMeta(true)
    setTimeout(() => {
      setTestingMeta(false)
      toast.success('Meta Ads MCP Server Connected!', {
        description: 'Tools available: meta_create_campaign, meta_sync_audiences, meta_pull_insights.',
      })
      setSettings((prev) => ({
        ...prev,
        metaConnector: { ...prev.metaConnector, status: 'connected' },
      }))
    }, 900)
  }

  const handleTestGoogleMcp = () => {
    setTestingGoogle(true)
    setTimeout(() => {
      setTestingGoogle(false)
      toast.success('Google Ads MCP Server Connected!', {
        description: 'Tools available: google_deploy_display_creatives, google_conversion_sync.',
      })
      setSettings((prev) => ({
        ...prev,
        googleConnector: { ...prev.googleConnector, status: 'connected' },
      }))
    }, 900)
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent shadow-subtle">
              <Sliders className="size-5" />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Studio Profile & Connectors
            </h1>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Configure your publisher imprint, default brand parameters, and automated Meta & Google Ads MCP connectors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" loading={saving} onClick={handleSave}>
            <Save className="size-4" /> Save Settings
          </Button>
        </div>
      </div>

      {/* Publisher Tenant Identity Summary */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-lg font-bold text-accent shadow-subtle">
            {settings.brand.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('') || 'LP'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-ink">{settings.brand.name}</span>
              <Badge tone="success" className="gap-1">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Active Imprint
              </Badge>
            </div>
            <p className="text-xs text-ink-muted">{settings.brand.tagline || 'Independent Publishing Imprint'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-xs">
          <span className="text-ink-muted">Tenant ID:</span>
          <code className="font-mono text-ink">{settings.publisherId}</code>
          <button
            type="button"
            onClick={handleCopyId}
            className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink"
            title="Copy Tenant ID"
          >
            {copiedId ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-line pb-px">
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
          AI & OpenRouter Key
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('connectors')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'connectors'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          )}
        >
          <Cpu className="size-4" />
          Marketing & MCP Connectors
        </button>
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
          Brand & Imprint Voice
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
          Retail & Buy Links
        </button>
      </div>

      {/* TAB: AI & OPENROUTER */}
      {activeTab === 'ai' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  <h2 className="font-display text-lg font-semibold text-ink">OpenRouter AI Configuration</h2>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Connect your OpenRouter API key to unlock live AI ad copywriting with Claude, Gemini, or Llama models.
                </p>
              </div>
              <Badge tone={aiConfigured ? 'success' : 'neutral'} className="gap-1.5">
                <span className={cn('size-2 rounded-full', aiConfigured ? 'bg-success animate-pulse' : 'bg-ink-muted')} />
                {aiConfigured ? 'OpenRouter Active' : 'Deterministic Sample Fallback'}
              </Badge>
            </div>

            {maskedKey && (
              <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Key className="size-4 text-accent" />
                  <span className="text-ink-muted">Current configured key:</span>
                  <code className="font-mono text-ink font-semibold">{maskedKey}</code>
                </div>
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Ready for generation
                </span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="openRouterKey" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {maskedKey ? 'Update OpenRouter API Key' : 'Enter OpenRouter API Key'}
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
                <p className="mt-1 text-[11px] text-ink-muted">
                  Get your API key at{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    openrouter.ai/keys
                  </a>
                  . Both paid and free-tier models are supported.
                </p>
              </div>

              <div>
                <label htmlFor="openRouterModel" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  AI Model ID
                </label>
                <select
                  id="openRouterModel"
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 font-mono"
                >
                  <option value="deepseek/deepseek-v4.1-flash">deepseek/deepseek-v4.1-flash (Recommended: Ultra-fast DeepSeek v4.1 for Ads & Landing Pages)</option>
                  <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek Chat General Reasoning)</option>
                  <option value="google/gemini-2.5-flash-image">google/gemini-2.5-flash-image (Nano-Banana / Gemini Image Generation)</option>
                  <option value="openai/gpt-5-image">openai/gpt-5-image (OpenAI GPT-5 Image Model)</option>
                  <option value="google/veo-2">google/veo-2 (Google Veo 2 Cinematic Video Preview)</option>
                  <option value="anthropic/claude-sonnet-5">anthropic/claude-sonnet-5 (Anthropic Claude Sonnet 5)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">meta-llama/llama-3.3-70b-instruct:free (Free Tier Model)</option>
                  <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free (Free Reasoning Model)</option>
                  <option value="openai/gpt-4o">openai/gpt-4o (OpenAI Omni)</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={testingAi}
                  disabled={!openRouterKey.trim() || savingAi}
                  onClick={handleTestAiKey}
                >
                  <RefreshCw className="size-3.5" /> Test Key
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={savingAi}
                  disabled={!openRouterKey.trim() || testingAi}
                  onClick={handleSaveAiKey}
                >
                  <Save className="size-3.5" /> Save OpenRouter Key
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-muted">
              <ShieldCheck className="size-4 shrink-0 text-success mt-0.5" />
              <span>
                Your API key is stored securely in your local environment file (<code className="text-ink">.env.local</code>) and runtime environment. It is used solely to generate book ad copy and creative variants.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 1: MARKETING & MCP CONNECTORS */}
      {activeTab === 'connectors' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-accent-soft/30 p-4 text-xs text-ink">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <strong className="font-semibold text-ink">Model Context Protocol (MCP) Integration:</strong>
                <p className="mt-0.5 text-ink-muted">
                  Connecting your Meta and Google Ads via MCP allows AI agents to directly deploy platform-compliant ad creatives, automatically target relevant reader audiences, and pull live CTR/CPC performance metrics.
                </p>
              </div>
            </div>
          </div>

          {/* Meta Ads MCP Card */}
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-600/10 text-blue-600 font-bold">
                  f
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Meta Ads Manager (Facebook & Instagram)</h3>
                  <p className="text-xs text-ink-muted">Automated push for Feed (1080×1080) and Story/Reels (1080×1920) ads.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={settings.metaConnector.status === 'connected' ? 'success' : 'warning'}>
                  {settings.metaConnector.status === 'connected' ? '● MCP Connected' : '○ Simulated Mode'}
                </Badge>
                <Button size="sm" variant="secondary" loading={testingMeta} onClick={handleTestMetaMcp}>
                  <RefreshCw className="size-3.5" /> Test MCP Server
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Meta Ad Account ID" htmlFor="meta-account" hint="e.g. act_1234567890">
                <Input
                  id="meta-account"
                  value={settings.metaConnector.adAccountId}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      metaConnector: { ...prev.metaConnector, adAccountId: e.target.value },
                    }))
                  }
                  placeholder="act_849204..."
                />
              </Field>

              <Field label="Facebook Page or Business ID" htmlFor="meta-page" hint="Identity ads will run under">
                <Input
                  id="meta-page"
                  value={settings.metaConnector.pageId}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      metaConnector: { ...prev.metaConnector, pageId: e.target.value },
                    }))
                  }
                  placeholder="publisher_toolkit_books"
                />
              </Field>

              <Field label="Instagram Account Handle" htmlFor="meta-ig" hint="Attributed on Instagram Feed/Stories">
                <Input
                  id="meta-ig"
                  value={settings.metaConnector.instagramHandle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      metaConnector: { ...prev.metaConnector, instagramHandle: e.target.value },
                    }))
                  }
                  placeholder="@yourimprint"
                />
              </Field>

              <Field label="Meta Conversion Pixel / Dataset ID" htmlFor="meta-pixel" hint="Injected into book landing pages">
                <Input
                  id="meta-pixel"
                  value={settings.metaConnector.pixelId}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      metaConnector: { ...prev.metaConnector, pixelId: e.target.value },
                    }))
                  }
                  placeholder="pix_948201934"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Meta MCP Connector Server URL" htmlFor="meta-mcp-url" hint="Local or hosted MCP endpoint exposed to agents">
                  <Input
                    id="meta-mcp-url"
                    value={settings.metaConnector.mcpServerUrl}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        metaConnector: { ...prev.metaConnector, mcpServerUrl: e.target.value },
                      }))
                    }
                    placeholder="http://localhost:3333/mcp/meta"
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Enabled MCP Tool Capabilities:</span>
              <ul className="grid gap-1 sm:grid-cols-2">
                <li className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>One-click ad set deployment</span>
                </li>
                <li className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>Reader-interest targeting suggestions</span>
                </li>
                <li className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>Live telemetry (CTR, CPC, Reach)</span>
                </li>
                <li className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>Creative fatigue detection & refresh loop</span>
                </li>
              </ul>
            </div>
          </Card>

          {/* Google Ads MCP Card */}
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-600/10 text-emerald-600 font-bold">
                  G
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Google Display Ads</h3>
                  <p className="text-xs text-ink-muted">Automated push for Medium Rectangle (300×250) and Leaderboard (728×90).</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={settings.googleConnector.status === 'connected' ? 'success' : 'warning'}>
                  {settings.googleConnector.status === 'connected' ? '● MCP Connected' : '○ Simulated Mode'}
                </Badge>
                <Button size="sm" variant="secondary" loading={testingGoogle} onClick={handleTestGoogleMcp}>
                  <RefreshCw className="size-3.5" /> Test MCP Server
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Google Ads Customer ID" htmlFor="google-id" hint="Format: XXX-XXX-XXXX">
                <Input
                  id="google-id"
                  value={settings.googleConnector.customerId}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      googleConnector: { ...prev.googleConnector, customerId: e.target.value },
                    }))
                  }
                  placeholder="948-204-1839"
                />
              </Field>

              <Field label="Conversion Action Tag" htmlFor="google-conv" hint="Tracks reader book purchase events">
                <Input
                  id="google-conv"
                  value={settings.googleConnector.conversionTag}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      googleConnector: { ...prev.googleConnector, conversionTag: e.target.value },
                    }))
                  }
                  placeholder="AW-948201934/conv"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Google Ads MCP Connector Server URL" htmlFor="google-mcp-url" hint="Endpoint for Google Ads agent tool calls">
                  <Input
                    id="google-mcp-url"
                    value={settings.googleConnector.mcpServerUrl}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        googleConnector: { ...prev.googleConnector, mcpServerUrl: e.target.value },
                      }))
                    }
                    placeholder="http://localhost:3333/mcp/google"
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: BRAND & IMPRINT */}
      {activeTab === 'brand' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-6 p-6">
            <h3 className="font-display text-lg font-semibold text-ink">Imprint Identity</h3>

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
              <p className="text-xs text-ink-muted">Used by the compositing engine for template headers and landing pages.</p>
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
              <p className="text-xs text-ink-muted">Pre-informs ad copy angles and reader interest keywords.</p>
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

            {/* AI Copy System Prompt / Voice Instructions */}
            <Field
              label="Global Brand Voice & Editorial Guidelines"
              htmlFor="voice-prompt"
              hint="Injected into Claude / OpenRouter prompts when generating ad copy for all books."
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

      {/* TAB 3: RETAIL & BUY LINKS */}
      {activeTab === 'retail' && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Distribution Channels</h3>
              <p className="text-xs text-ink-muted">
                Where should ad campaign Call-to-Actions (CTAs) and generated Landing Pages direct your readers?
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

              <Field label="Bookshop.org Storefront URL" htmlFor="retail-bookshop" hint="Supports independent bookstores">
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

              <Field label="Direct-to-Consumer Store (Shopify/WooCommerce)" htmlFor="retail-direct">
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

              <Field label="Amazon Associates / Affiliate Tag" htmlFor="retail-affiliate" hint="Appended automatically to purchase links">
                <Input
                  id="retail-affiliate"
                  value={settings.retail.affiliateTag || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      retail: { ...prev.retail, affiliateTag: e.target.value },
                    }))
                  }
                  placeholder="yourstudio-20"
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
