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
  ExternalLink,
  BookOpen,
  Smartphone,
  Monitor,
  ShoppingBag,
  Quote,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea, Field } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import {
  LANDING_TEMPLATES,
  THEME_OPTIONS,
  RETAILER_PRESETS,
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
  const [sampleChapterTitle, setSampleChapterTitle] = useState<string>(initial.sampleChapterTitle || 'Chapter 1: The Beginning')
  const [sampleChapterText, setSampleChapterText] = useState<string>(initial.sampleChapterText || '')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

  const [retailers, setRetailers] = useState<{ retailer: string; url: string }[]>(
    initial.retailerLinks && initial.retailerLinks.length > 0
      ? initial.retailerLinks
      : [
          { retailer: 'Amazon', url: 'https://amazon.com' },
          { retailer: 'Barnes & Noble', url: 'https://barnesandnoble.com' },
          { retailer: 'Apple Books', url: 'https://books.apple.com' },
        ]
  )

  const [reviews, setReviews] = useState<{ quote: string; reviewer: string; outlet?: string }[]>(
    initial.reviews && initial.reviews.length > 0
      ? initial.reviews
      : [
          { quote: 'An extraordinary achievement in contemporary storytelling.', reviewer: 'Literary Review', outlet: 'Starred Review' },
          { quote: 'Unputdownable, richly atmospheric, and thoroughly brilliant.', reviewer: 'Book Chronicle', outlet: 'Editor’s Pick' },
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
    setReviews((prev) => [...prev, { quote: 'A thrilling, unforgettable page-turner.', reviewer: 'New Critic', outlet: 'Book World' }])
  }

  const removeReview = (index: number) => {
    setReviews((prev) => prev.filter((_, i) => i !== index))
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
        <div className="flex items-center justify-between border-b border-line/60 bg-surface-2/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            <span className="font-semibold text-sm">Interactive Landing Page Preview</span>
          </div>

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

        <div className="flex justify-center bg-black/90 p-4 sm:p-6 overflow-hidden">
          <div
            className={cn(
              'h-[460px] overflow-hidden rounded-xl border border-line/30 bg-surface transition-all duration-300 shadow-2xl',
              previewMode === 'desktop' ? 'w-full max-w-5xl' : 'w-[375px]'
            )}
          >
            <iframe
              src={`/api/landing/projects/${projectId}/preview`}
              className="h-full w-full border-0 bg-background"
              title="Landing Page Preview"
            />
          </div>
        </div>
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
        <h3 className="font-display text-base font-semibold">Book Headlines & Synopsis</h3>
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
              placeholder="Author bio and accolades..."
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
              <Quote className="size-4 text-accent" /> Praise & Critical Acclaim
            </h3>
            <p className="text-xs text-ink-muted">Quotes from media, authors, and starred reviews.</p>
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

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="lg" loading={pending}>
          <Sparkles className="size-4" /> Save & Publish Website
        </Button>
      </div>
    </form>
  )
}
