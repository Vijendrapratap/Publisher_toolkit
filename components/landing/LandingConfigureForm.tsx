'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  LayoutTemplate,
  Palette,
  Sparkles,
  Check,
  Globe,
  Download,
  BookOpen,
  Smartphone,
  Monitor,
  ShoppingBag,
  Quote,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Target,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea, Field } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import {
  LANDING_TEMPLATES,
  THEME_OPTIONS,
  type LandingTemplateKey,
  type LandingThemeKey,
} from '@/lib/services/landing/options'

const ACCENT_PRESETS = [
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Crimson', hex: '#ef4444' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Violet', hex: '#8b5cf6' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Rose', hex: '#fb7185' },
]

const OBJECTIVE_OPTIONS = [
  {
    key: 'preorder',
    label: 'Book Launch & Pre-Orders',
    description: 'High-urgency hero layout designed to maximize immediate sales on Amazon, Barnes & Noble, and Apple Books.',
    icon: ShoppingBag,
  },
  {
    key: 'newsletter',
    label: 'Author Fanbase & Newsletter',
    description: 'Build a dedicated reader inner circle with a prominent reader magnet gift (free chapter, novella, bonus scenes).',
    icon: Mail,
  },
  {
    key: 'brand',
    label: 'Author Brand & Series Universe',
    description: 'Spotlight the author’s credentials, origin story, literary philosophy, and overarching book series universe.',
    icon: User,
  },
  {
    key: 'speaking',
    label: 'Media, Press & Speaking',
    description: 'Highlight critical acclaim, press coverage, speaking topics, and media kit inquiries for prestige positioning.',
    icon: Target,
  },
] as const

export function LandingConfigureForm({
  projectId,
  initial,
  book,
}: {
  projectId: string
  initial: {
    template: LandingTemplateKey
    theme: LandingThemeKey
    accentColor: string
    ctaText: string
    subtitle?: string | null
    authorBio?: string | null
    synopsis?: string | null
    sampleChapterTitle?: string | null
    sampleChapterText?: string | null
    retailerLinks?: { retailer: string; url: string }[] | null
    reviews?: { quote: string; reviewer: string; outlet?: string }[] | null
  }
  book: { title: string; author: string; coverUrl?: string | null }
}) {
  const router = useRouter()
  const [template, setTemplate] = useState<LandingTemplateKey>(initial.template || 'bestseller')
  const [theme, setTheme] = useState<LandingThemeKey>(initial.theme || 'matt')
  const [accentColor, setAccentColor] = useState<string>(initial.accentColor || '#6366f1')
  const [ctaText, setCtaText] = useState<string>(initial.ctaText || 'Order Your Copy Today')
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle || '')
  const [synopsis, setSynopsis] = useState<string>(initial.synopsis || '')
  const [authorBio, setAuthorBio] = useState<string>(initial.authorBio || '')
  const [sampleChapterTitle, setSampleChapterTitle] = useState<string>(
    initial.sampleChapterTitle || 'Chapter 1: The Beginning'
  )
  const [sampleChapterText, setSampleChapterText] = useState<string>(initial.sampleChapterText || '')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)

  // Agent Questionnaire State
  const [agentOpen, setAgentOpen] = useState(true)
  const [agentRunning, setAgentRunning] = useState(false)
  const [primaryObjective, setPrimaryObjective] = useState<'preorder' | 'newsletter' | 'brand' | 'speaking'>(
    'preorder'
  )
  const [authorPersona, setAuthorPersona] = useState('')
  const [authorVoice, setAuthorVoice] = useState('Atmospheric, captivating, and emotionally profound')
  const [authorQuote, setAuthorQuote] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [readerMagnet, setReaderMagnet] = useState('')
  const [otherWorks, setOtherWorks] = useState('')

  const [retailers, setRetailers] = useState<{ retailer: string; url: string }[]>(
    initial.retailerLinks && initial.retailerLinks.length > 0
      ? initial.retailerLinks
      : [
          { retailer: 'Amazon', url: 'https://amazon.com' },
          { retailer: 'Barnes & Noble', url: 'https://barnesandnoble.com' },
          { retailer: 'Apple Books', url: 'https://books.apple.com' },
          { retailer: 'Audible', url: 'https://audible.com' },
        ]
  )

  const [reviews, setReviews] = useState<{ quote: string; reviewer: string; outlet?: string }[]>(
    initial.reviews && initial.reviews.length > 0
      ? initial.reviews
      : [
          {
            quote: 'An extraordinary achievement in contemporary storytelling. Gripping and unforgettable.',
            reviewer: 'Literary Chronicle',
            outlet: 'Starred Review',
          },
          {
            quote: 'Breathless pacing, richly drawn characters, and twists you will never see coming.',
            reviewer: 'Book Review Weekly',
            outlet: 'Editor’s Choice',
          },
        ]
  )

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addRetailer = () => {
    setRetailers((prev) => [...prev, { retailer: 'Bookshop.org', url: 'https://bookshop.org' }])
  }

  const removeRetailer = (index: number) => {
    setRetailers((prev) => prev.filter((_, i) => i !== index))
  }

  const addReview = () => {
    setReviews((prev) => [
      ...prev,
      { quote: 'A thrilling, unforgettable page-turner.', reviewer: 'New Critic', outlet: 'Book World' },
    ])
  }

  const removeReview = (index: number) => {
    setReviews((prev) => prev.filter((_, i) => i !== index))
  }

  // DeepSeek v4.1 Author & Objective Agent Execution
  async function handleRunAgent() {
    setAgentRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/landing/projects/${projectId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle: book.title,
          authorName: book.author,
          authorPersona,
          authorVoice,
          authorQuote,
          primaryObjective,
          targetAudience,
          readerMagnet,
          otherWorks,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Agent generation failed')

      const out = data.agentResult
      if (out) {
        if (out.subtitle) setSubtitle(out.subtitle)
        if (out.authorBio) setAuthorBio(out.authorBio)
        if (out.synopsis) setSynopsis(out.synopsis)
        if (out.ctaText) setCtaText(out.ctaText)
        if (out.recommendedTemplate) setTemplate(out.recommendedTemplate)
        if (out.recommendedTheme) setTheme(out.recommendedTheme)
        if (out.recommendedAccent) setAccentColor(out.recommendedAccent)
        if (out.reviews && out.reviews.length > 0) setReviews(out.reviews)
      }

      setPreviewKey((k) => k + 1)
      toast.success('Landing page generated with DeepSeek v4.1!', {
        description: `Optimized for ${book.author} and the ${primaryObjective} objective.`,
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate landing page with AI')
    } finally {
      setAgentRunning(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const res = await fetch(`/api/landing/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template,
        theme,
        accentColor,
        ctaText,
        subtitle,
        synopsis,
        authorBio,
        sampleChapterTitle,
        sampleChapterText,
        retailerLinks: retailers,
        reviews,
      }),
    })

    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'Failed to save configuration.'
      setError(message)
      toast.error(message)
      return
    }

    router.push(`/landing/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* Live Preview Bar */}
      <Card className="overflow-hidden p-0 border border-line/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 bg-surface-2/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            <span className="font-semibold text-sm">Interactive Sandbox Preview</span>
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-mono text-accent font-semibold">
              Live Refresh
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/landing/projects/${projectId}/html`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-subtle hover:bg-surface-2 transition-colors"
            >
              <Download className="size-3.5 text-accent" /> Download index.html
            </a>

            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              className="p-1.5 text-ink-muted hover:text-ink rounded-md transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw className="size-3.5" />
            </button>

            <div className="flex items-center gap-1 rounded-lg bg-surface-3 p-1">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all',
                  previewMode === 'desktop' ? 'bg-surface text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                )}
              >
                <Monitor className="size-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all',
                  previewMode === 'mobile' ? 'bg-surface text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                )}
              >
                <Smartphone className="size-3.5" /> Mobile
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center bg-black/95 p-4 sm:p-6 overflow-hidden">
          <div
            className={cn(
              'h-[480px] overflow-hidden rounded-xl border border-line/30 bg-surface transition-all duration-300 shadow-2xl',
              previewMode === 'desktop' ? 'w-full max-w-5xl' : 'w-[375px]'
            )}
          >
            <iframe
              key={previewKey}
              src={`/api/landing/projects/${projectId}/preview?ts=${previewKey}`}
              className="h-full w-full border-0 bg-background"
              title="Landing Page Preview"
            />
          </div>
        </div>
      </Card>

      {/* AI Author & Objective Agent Section (DeepSeek v4.1) */}
      <Card className="border-accent/40 bg-gradient-to-br from-accent/10 via-surface to-surface p-6 shadow-card">
        <div className="flex items-start justify-between cursor-pointer" onClick={() => setAgentOpen((o) => !o)}>
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-on-accent shadow-card shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold">DeepSeek v4.1 Author &amp; Objective Agent</h3>
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-accent uppercase">
                  DeepSeek v4.1
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                Design a page crafted around the author’s persona and campaign objective. Answer the questions below to have DeepSeek v4.1 synthesize compelling copy, origin story, and conversion strategy.
              </p>
            </div>
          </div>

          <button type="button" className="text-ink-muted hover:text-ink p-1">
            {agentOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        </div>

        {agentOpen && (
          <div className="mt-6 flex flex-col gap-5 border-t border-line/40 pt-5">
            {/* Question 1: Campaign Objective */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-ink">
                1. What is the primary objective of this landing page?
              </label>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                {OBJECTIVE_OPTIONS.map((opt) => {
                  const selected = primaryObjective === opt.key
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPrimaryObjective(opt.key)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                        selected
                          ? 'border-accent bg-accent/15 ring-2 ring-accent/30 font-semibold'
                          : 'border-line/60 bg-surface hover:border-accent/40'
                      )}
                    >
                      <Icon className={cn('size-4 mt-0.5 shrink-0', selected ? 'text-accent' : 'text-ink-muted')} />
                      <div>
                        <div className="font-semibold text-sm text-ink">{opt.label}</div>
                        <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">{opt.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question 2: Author Persona & Origin Story */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="2. Author Background & Origin Story"
                hint="e.g., Former cold case investigator, folklore scholar, debut voice, award-winning journalist"
                htmlFor="agent-persona"
              >
                <Input
                  id="agent-persona"
                  value={authorPersona}
                  onChange={(e) => setAuthorPersona(e.target.value)}
                  placeholder="e.g., Investigative journalist with 15 years in international reporting"
                />
              </Field>

              <Field
                label="Author Voice & Tone"
                hint="e.g., Atmospheric & Lyrical, Gritty Noir, Witty & Intimate, Cerebral"
                htmlFor="agent-voice"
              >
                <Input
                  id="agent-voice"
                  value={authorVoice}
                  onChange={(e) => setAuthorVoice(e.target.value)}
                  placeholder="e.g., Atmospheric, cinematic, and emotionally intense"
                />
              </Field>
            </div>

            {/* Question 3: Guiding Quote & Target Readers */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="3. Author Philosophy or Personal Quote"
                hint="Reflective motto or signature quote by the author"
                htmlFor="agent-quote"
              >
                <Input
                  id="agent-quote"
                  value={authorQuote}
                  onChange={(e) => setAuthorQuote(e.target.value)}
                  placeholder="e.g., The darkest truths are always whispered in silence."
                />
              </Field>

              <Field
                label="Target Readers & Comparable Authors (Comps)"
                hint="e.g., Fans of Gillian Flynn, Alex Michaelides, and V.E. Schwab"
                htmlFor="agent-target"
              >
                <Input
                  id="agent-target"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Fans of Tana French and David Fincher style mysteries"
                />
              </Field>
            </div>

            {/* Question 4: Reader Magnet & Backlist */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="4. Reader Magnet / Incentive for Email Club"
                hint="Free gift to convert readers into lifelong fans"
                htmlFor="agent-magnet"
              >
                <Input
                  id="agent-magnet"
                  value={readerMagnet}
                  onChange={(e) => setReaderMagnet(e.target.value)}
                  placeholder="e.g., Exclusive prequel novella & annotated chapter 1"
                />
              </Field>

              <Field
                label="Other Works / Series Universe"
                hint="e.g., Book 1 of The Eldoria Trilogy, Author of The Whispering Tide"
                htmlFor="agent-works"
              >
                <Input
                  id="agent-works"
                  value={otherWorks}
                  onChange={(e) => setOtherWorks(e.target.value)}
                  placeholder="e.g., Author of the acclaimed 'Shadows of Dublin' series"
                />
              </Field>
            </div>

            {/* Trigger Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-ink-muted">
                Generates author profile, synopsis, quote, reviews, and template styling.
              </span>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={agentRunning}
                onClick={handleRunAgent}
                className="shadow-card"
              >
                <Sparkles className="size-4" /> Synthesize with DeepSeek v4.1
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Template Selection */}
      <Card className="p-6">
        <fieldset>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <legend className="flex items-center gap-2 font-display text-lg font-semibold">
              <LayoutTemplate className="size-5 text-accent" /> Design Template
            </legend>
            <span className="text-xs text-ink-muted">Tailored layouts optimized for conversions</span>
          </div>

          <div role="radiogroup" aria-label="Template" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_TEMPLATES.map((tmpl) => {
              const selected = template === tmpl.key
              return (
                <button
                  key={tmpl.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setTemplate(tmpl.key)
                    setAccentColor(tmpl.accent)
                  }}
                  className={cn(
                    'relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all',
                    selected
                      ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 shadow-subtle'
                      : 'border-line/60 bg-surface hover:border-accent/40 shadow-subtle'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{tmpl.label}</span>
                      <span
                        className={cn(
                          'grid size-5 place-items-center rounded-full border',
                          selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2'
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </span>
                    </div>
                    <span className="text-xs text-accent font-medium">{tmpl.tagline}</span>
                    <p className="mt-2 text-xs text-ink-muted leading-relaxed">{tmpl.description}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1 border-t border-line/40 pt-2">
                    {tmpl.bestFor.slice(0, 2).map((b) => (
                      <span key={b} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
                        {b}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* Theme & Palette */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6">
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-base font-semibold">
              <Palette className="size-4 text-accent" /> Surface Theme
            </legend>
            <p className="mt-1 text-xs text-ink-muted">Background tones and contrast</p>
            <div role="radiogroup" className="mt-4 grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((th) => {
                const selected = theme === th.key
                return (
                  <button
                    key={th.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(th.key)}
                    className={cn(
                      'flex flex-col items-center rounded-xl border p-3 text-center transition-all',
                      selected
                        ? 'border-accent bg-accent-soft/60 ring-2 ring-accent/30 font-semibold'
                        : 'border-line/60 bg-surface hover:border-accent/40'
                    )}
                  >
                    <span className="text-sm font-semibold">{th.label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Card>

        <Card className="p-6">
          <fieldset>
            <legend className="flex items-center gap-2 font-display text-base font-semibold">
              <Sparkles className="size-4 text-accent" /> Accent Highlight Color
            </legend>
            <p className="mt-1 text-xs text-ink-muted">CTA buttons, badges, and glows</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setAccentColor(p.hex)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full shadow-subtle ring-offset-2 transition-transform hover:scale-110',
                    accentColor.toLowerCase() === p.hex.toLowerCase() ? 'ring-2 ring-accent' : ''
                  )}
                  style={{ backgroundColor: p.hex }}
                  title={p.label}
                >
                  {accentColor.toLowerCase() === p.hex.toLowerCase() && <Check className="size-4 text-white" />}
                </button>
              ))}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
            </div>
          </fieldset>
        </Card>
      </div>

      {/* Hero Content & Synopsis */}
      <Card className="p-6">
        <h3 className="font-display text-base font-semibold">Headlines &amp; Book Synopsis</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Subtitle / Hook Headline" htmlFor="lp-sub">
            <Input
              id="lp-sub"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="An unforgettable story of ambition and intrigue..."
            />
          </Field>
          <Field label="Primary Call To Action Button" htmlFor="lp-cta">
            <Input
              id="lp-cta"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Order Your Copy Today"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Book Synopsis" htmlFor="lp-syn">
            <Textarea
              id="lp-syn"
              rows={4}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="When an unexpected discovery shatters the peace..."
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="About The Author Biography" htmlFor="lp-bio">
            <Textarea
              id="lp-bio"
              rows={3}
              value={authorBio}
              onChange={(e) => setAuthorBio(e.target.value)}
              placeholder="Author bio, origin story, and accolades..."
            />
          </Field>
        </div>
      </Card>

      {/* Retailers & Purchase Links */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <ShoppingBag className="size-4 text-accent" /> Retailer Buy Links
            </h3>
            <p className="text-xs text-ink-muted">Where readers can purchase your book.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addRetailer}>
            <Plus className="size-4" /> Add Retailer
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {retailers.map((r, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Input
                value={r.retailer}
                onChange={(e) => {
                  const val = e.target.value
                  setRetailers((prev) => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], retailer: val }
                    return next
                  })
                }}
                className="w-1/3"
                placeholder="Retailer Name"
              />
              <Input
                value={r.url}
                onChange={(e) => {
                  const val = e.target.value
                  setRetailers((prev) => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], url: val }
                    return next
                  })
                }}
                className="flex-1 font-mono text-xs"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={() => removeRetailer(idx)}
                className="p-2 text-ink-muted hover:text-danger transition-colors"
                title="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Reviews & Social Proof */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <Quote className="size-4 text-accent" /> Praise &amp; Critical Acclaim
            </h3>
            <p className="text-xs text-ink-muted">Quotes from media, critics, and starred reviews.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addReview}>
            <Plus className="size-4" /> Add Quote
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {reviews.map((rev, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-xl border border-line/60 bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-accent">Review #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeReview(idx)}
                  className="text-xs text-ink-muted hover:text-danger"
                >
                  Remove
                </button>
              </div>
              <Input
                value={rev.quote}
                onChange={(e) => {
                  const val = e.target.value
                  setReviews((prev) => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], quote: val }
                    return next
                  })
                }}
                placeholder="Review quote text..."
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={rev.reviewer}
                  onChange={(e) => {
                    const val = e.target.value
                    setReviews((prev) => {
                      const next = [...prev]
                      next[idx] = { ...next[idx], reviewer: val }
                      return next
                    })
                  }}
                  placeholder="Reviewer Name / Outlet"
                />
                <Input
                  value={rev.outlet || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setReviews((prev) => {
                      const next = [...prev]
                      next[idx] = { ...next[idx], outlet: val }
                      return next
                    })
                  }}
                  placeholder="Starred Review / Honor"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sample Chapter Excerpt */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <BookOpen className="size-4 text-accent" /> Sample Chapter Reader Drawer
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          Give prospective readers an immediate taste of your narrative prose.
        </p>

        <div className="mt-4">
          <Field label="Sample Chapter Title" htmlFor="lp-sample-title">
            <Input
              id="lp-sample-title"
              value={sampleChapterTitle}
              onChange={(e) => setSampleChapterTitle(e.target.value)}
              placeholder="Chapter 1: The Beginning"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Sample Excerpt Text" htmlFor="lp-sample-text">
            <Textarea
              id="lp-sample-text"
              rows={6}
              value={sampleChapterText}
              onChange={(e) => setSampleChapterText(e.target.value)}
              placeholder="The story began..."
              className="font-serif text-xs leading-relaxed"
            />
          </Field>
        </div>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <a
          href={`/api/landing/projects/${projectId}/html`}
          download
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <Download className="size-3.5" /> Download standalone HTML file (index.html)
        </a>

        <Button type="submit" size="lg" loading={pending}>
          <Sparkles className="size-4" /> Save &amp; Publish Website
        </Button>
      </div>
    </form>
  )
}
