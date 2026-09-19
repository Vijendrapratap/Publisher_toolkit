'use client'
import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookOpen,
  ChevronDown,
  FileUp,
  Info,
  Library,
  Megaphone,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import {
  CAMPAIGN_OBJECTIVES,
  CTA_PRESETS,
  TEMPLATES,
  TONES,
  type CampaignObjectiveKey,
  type CopyTone,
  type TemplateKey,
} from '@/lib/services/ads/options'

export interface LibraryBookItem {
  id: string
  title: string
  author: string
  blurb: string
  frontCoverUrl: string | null
  campaignCount: number
  createdAt: string | Date
}

export function NewProjectForm({ initialBooks }: { initialBooks?: LibraryBookItem[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'library' | 'quick' | 'upload'>('upload')
  const [library, setLibrary] = useState<LibraryBookItem[]>(initialBooks ?? [])
  const [loadingLibrary, setLoadingLibrary] = useState(!initialBooks)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Quick setup state
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAuthor, setQuickAuthor] = useState('')
  const [quickBlurb, setQuickBlurb] = useState('')
  const [quickCover, setQuickCover] = useState<File | null>(null)

  // Campaign settings for existing book or new upload
  const [campaignName, setCampaignName] = useState('')
  const [campaignObjective, setCampaignObjective] = useState<CampaignObjectiveKey>('launch')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('classic')
  const [copyTone, setCopyTone] = useState<CopyTone>('literary')
  const [ctaText, setCtaText] = useState<string>(CTA_PRESETS[0])

  // New PDF upload state
  const [pdf, setPdf] = useState<File | null>(null)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [showCovers, setShowCovers] = useState(false)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBooks && initialBooks.length > 0) {
      setTab('library')
      setSelectedBookId(initialBooks[0].id)
      setCampaignName(`${initialBooks[0].title} - Campaign`)
      return
    }

    async function load() {
      try {
        const res = await fetch('/api/ads/library')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.books) && data.books.length > 0) {
            setLibrary(data.books)
            setTab('library')
            setSelectedBookId(data.books[0].id)
            setCampaignName(`${data.books[0].title} - Campaign`)
          }
        }
      } catch {
        // Fallback gracefully to quick mode
      } finally {
        setLoadingLibrary(false)
      }
    }
    load()
  }, [initialBooks])

  function handleSelectBook(book: LibraryBookItem) {
    setSelectedBookId(book.id)
    if (!campaignName || campaignName.endsWith(' - Campaign') || campaignName === 'New Campaign') {
      setCampaignName(`${book.title} - ${CAMPAIGN_OBJECTIVES.find((o) => o.key === campaignObjective)?.label.split('/')[0].trim()}`)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    if (tab === 'library') {
      if (!selectedBookId) {
        setPending(false)
        setError('Please select a book from your library to start a campaign.')
        return
      }

      const res = await fetch('/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingBookId: selectedBookId,
          campaignName: campaignName.trim() || 'New Campaign',
          campaignObjective,
          templateKey,
          copyTone,
          ctaText,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Failed to create campaign from selected book.')
        return
      }

      toast.success('Campaign created', { description: 'Ready to configure and generate creatives.' })
      router.push(`/ads/${json.id}/configure`)
      router.refresh()
      return
    }

    if (tab === 'quick') {
      const titleToUse = quickTitle.trim() || campaignName.trim()
      if (!titleToUse && !quickCover) {
        setPending(false)
        setError('Please enter a book title to create your campaign.')
        return
      }

      const body = new FormData()
      body.append('title', titleToUse || 'Untitled Book')
      body.append('author', quickAuthor.trim())
      body.append('blurb', quickBlurb.trim())
      if (quickCover) body.append('frontCover', quickCover)
      body.append('campaignName', campaignName.trim() || `${titleToUse || 'New'} - Campaign`)
      body.append('campaignObjective', campaignObjective)
      body.append('templateKey', templateKey)
      body.append('copyTone', copyTone)
      body.append('ctaText', ctaText)

      const res = await fetch('/api/ads/projects', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Something went wrong creating your campaign. Please try again.')
        return
      }

      if (json.needsManualCover) {
        toast.success('Book details saved', { description: 'Please add a cover image to generate your creatives.' })
        router.push(`/ads/${json.id}/upload`)
      } else {
        toast.success('Campaign created', { description: 'Ready to configure and generate creatives.' })
        router.push(`/ads/${json.id}/configure`)
      }
      router.refresh()
      return
    }

    // Tab is upload
    if (!pdf) {
      setPending(false)
      setError('Choose your book PDF to continue.')
      return
    }

    const body = new FormData()
    body.append('pdf', pdf)
    if (front) body.append('frontCover', front)
    if (back) body.append('backCover', back)
    if (campaignName.trim()) body.append('campaignName', campaignName.trim())
    body.append('campaignObjective', campaignObjective)
    body.append('templateKey', templateKey)
    body.append('copyTone', copyTone)
    body.append('ctaText', ctaText)

    const res = await fetch('/api/ads/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book. Please try again.')
      return
    }

    toast.success('Book uploaded', { description: 'Check the details we found, then configure your ads.' })
    router.push(`/ads/${json.id}/upload`)
    router.refresh()
  }

  const filteredLibrary = library.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="p-6 sm:p-8">
      {/* Tab Switcher */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => {
            setTab('library')
            setError(null)
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'library'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          )}
        >
          <Library className="size-4" aria-hidden />
          Choose from library
          {library.length > 0 && (
            <span
              className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-xs',
                tab === 'library' ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-muted'
              )}
            >
              {library.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('quick')
            setError(null)
          }}
          className={cn(
            'relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'quick'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'border border-accent/30 bg-accent-soft/30 text-ink hover:bg-accent-soft/50'
          )}
        >
          <Zap className="size-4 text-amber-500" aria-hidden />
          Quick setup (No PDF)
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              tab === 'quick' ? 'bg-white/20 text-white' : 'bg-accent text-on-accent'
            )}
          >
            Recommended
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('upload')
            setError(null)
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'upload'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          )}
        >
          <FileUp className="size-4" aria-hidden />
          Upload book PDF
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {tab === 'library' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Select a book from your library</h2>
              <p className="text-sm text-ink-muted">
                Run another campaign for a previously uploaded book without uploading the PDF again.
              </p>
            </div>

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-10 text-sm text-ink-muted">
                Loading your book library…
              </div>
            ) : library.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
                <BookOpen className="size-8 text-ink-muted" aria-hidden />
                <p className="mt-3 font-medium">No books uploaded yet</p>
                <p className="mt-1 text-sm text-ink-muted">Start with our quick setup or upload your first book PDF.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={() => setTab('quick')}>
                    Quick setup (No PDF)
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setTab('upload')}>
                    Upload book PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 size-4 text-ink-muted" aria-hidden />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by book title or author…"
                    className="w-full rounded-xl border border-line bg-surface-2 py-2 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div className="grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredLibrary.map((b) => {
                    const isSelected = selectedBookId === b.id
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBook(b)}
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border p-3 text-left transition-all',
                          isSelected
                            ? 'border-accent bg-accent-soft/70 shadow-inset ring-2 ring-accent/30'
                            : 'border-transparent bg-surface-2 shadow-subtle hover:border-accent/40'
                        )}
                      >
                        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface shadow-inset">
                          {b.frontCoverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.frontCoverUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <BookOpen className="size-6 text-ink-muted" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{b.title}</p>
                          <p className="truncate text-xs text-ink-muted">{b.author}</p>
                          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                            <Megaphone className="size-3" aria-hidden />
                            {b.campaignCount} {b.campaignCount === 1 ? 'campaign' : 'campaigns'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'quick' && (
          <div className="flex flex-col gap-6">
            {/* Reassuring Banner */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-accent/25 bg-accent-soft/30 p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Token-efficient & fast setup</p>
                <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                  Skip uploading large PDF files. All you need for ads is the book title, a short blurb, and your cover image.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="quickTitle" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Book title <span className="text-danger">*</span>
                </label>
                <input
                  id="quickTitle"
                  type="text"
                  value={quickTitle}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuickTitle(val)
                    if (error) setError(null)
                    if (!campaignName || campaignName.endsWith(' - Campaign') || campaignName === 'New Campaign') {
                      setCampaignName(val.trim() ? `${val.trim()} - Campaign` : '')
                    }
                  }}
                  placeholder="e.g. The Midnight Library"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="quickAuthor" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Author
                </label>
                <input
                  id="quickAuthor"
                  type="text"
                  value={quickAuthor}
                  onChange={(e) => setQuickAuthor(e.target.value)}
                  placeholder="e.g. Matt Haig"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="quickBlurb" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Blurb / Description
                </label>
                <textarea
                  id="quickBlurb"
                  rows={4}
                  value={quickBlurb}
                  onChange={(e) => setQuickBlurb(e.target.value)}
                  placeholder="Short synopsis, tagline, or back-cover blurb to inspire ad copy…"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <Dropzone
                  id="quickCover"
                  label="Front cover image (optional, recommended)"
                  rule={COVER_RULE}
                  file={quickCover}
                  onFileChange={setQuickCover}
                  compact
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="flex flex-col gap-6">
            {/* Informational Tip Box */}
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-xs text-ink-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <p className="leading-relaxed">
                <strong className="font-semibold text-ink">Tip:</strong> Ads only use the title, blurb, and cover. Interior book pages and images are never sent to AI. If you already have your cover image and blurb, use the Quick setup tab to save time and bandwidth.
              </p>
            </div>

            <Dropzone id="pdf" label="Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />

            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setShowCovers((s) => !s)}
                aria-expanded={showCovers}
                className="flex items-center gap-2 self-start text-sm font-medium text-accent"
              >
                <ChevronDown className={cn('size-4 transition-transform', showCovers && 'rotate-180')} aria-hidden />
                Add your own cover images (optional)
              </button>
              {showCovers && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Dropzone id="frontCover" label="Front cover" rule={COVER_RULE} file={front} onFileChange={setFront} compact />
                  <Dropzone id="backCover" label="Back cover" rule={COVER_RULE} file={back} onFileChange={setBack} compact />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Campaign & Style Customization Section */}
        <div className="flex flex-col gap-5 rounded-2xl border border-line/60 bg-surface-2/60 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Campaign details & style</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="campaignName" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Campaign name
              </label>
              <input
                id="campaignName"
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={quickTitle ? `${quickTitle} - Campaign` : 'e.g. Summer Pre-Order Blitz'}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="ctaText" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Primary Call To Action (CTA)
              </label>
              <select
                id="ctaText"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {CTA_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Target className="size-3.5" aria-hidden /> Campaign objective
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {CAMPAIGN_OBJECTIVES.map((obj) => {
                const isSelected = campaignObjective === obj.key
                return (
                  <button
                    key={obj.key}
                    type="button"
                    onClick={() => {
                      setCampaignObjective(obj.key)
                      setCtaText(obj.defaultCta)
                    }}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                      isSelected
                        ? 'border-accent bg-accent-soft/80 shadow-inset ring-2 ring-accent/30'
                        : 'border-transparent bg-surface shadow-subtle hover:border-accent/40'
                    )}
                  >
                    <span className="text-xs font-bold text-accent">{obj.badge}</span>
                    <span className="text-xs font-semibold">{obj.label}</span>
                    <span className="text-[11px] text-ink-muted">{obj.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Palette className="size-3.5" aria-hidden /> Design aesthetic / style
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {TEMPLATES.map((tpl) => {
                const isSelected = templateKey === tpl.key
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setTemplateKey(tpl.key)}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-accent shadow-inset ring-2 ring-accent/30'
                        : 'border-transparent bg-surface shadow-subtle hover:border-accent/40'
                    )}
                  >
                    <div
                      className="flex h-10 items-center justify-between px-3"
                      style={{ background: tpl.palette.background }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tpl.palette.ink }}>
                        {tpl.key}
                      </span>
                      <span className="size-2.5 rounded-full" style={{ background: tpl.palette.accent }} />
                    </div>
                    <div className="bg-surface p-2">
                      <p className="truncate text-xs font-semibold">{tpl.label}</p>
                      <p className="line-clamp-1 text-[10px] text-ink-muted">{tpl.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> Your files stay private to your account.
          </p>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={pending}
          >
            {pending
              ? 'Setting up campaign…'
              : tab === 'library'
                ? 'Create campaign for book'
                : tab === 'quick'
                  ? 'Create campaign'
                  : 'Upload and continue'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
