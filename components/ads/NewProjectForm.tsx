'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileUp,
  Film,
  Info,
  Layers,
  Library,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { InteriorImagesDropzone } from '@/components/platform/InteriorImagesDropzone'
import { CustomPalettePicker } from '@/components/ads/CustomPalettePicker'
import { CustomCampaignPicker } from '@/components/ads/CustomCampaignPicker'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import {
  CAMPAIGN_OBJECTIVES,
  CTA_PRESETS,
  TEMPLATES,
  getCampaignObjective,
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

export type ContentGoalKey = 'all' | 'aplus' | 'video' | 'sponsored'

export const CONTENT_GOALS = [
  {
    key: 'all' as ContentGoalKey,
    title: 'Full Amazon Launch Bundle',
    badge: 'All-In-One',
    description: 'A+ Content Modules, Remotion HD Video Trailer, Sponsored Ads & high-converting ad copy.',
    tags: ['A+ Content', 'Video Trailer', 'Sponsored Ads', 'Ad Copy'],
    icon: Sparkles,
  },
  {
    key: 'aplus' as ContentGoalKey,
    title: 'Amazon A+ Content Suite',
    badge: 'KDP Enhanced',
    description: 'High-converting listing modules: Hero Banner (970×600), Feature Spread (970×300), and Quad Cards (300×300).',
    tags: ['Hero 970×600', 'Feature 970×300', 'Quad 300×300'],
    icon: Layers,
  },
  {
    key: 'video' as ContentGoalKey,
    title: 'Amazon Video Trailer',
    badge: 'Remotion HD',
    description: 'Cinematic video trailers for product pages (16:9) and social feeds (9:16) with dynamic motion & hyperframes.',
    tags: ['16:9 Product Video', '9:16 Reels / Shorts', 'Remotion HD'],
    icon: Film,
  },
  {
    key: 'sponsored' as ContentGoalKey,
    title: 'Sponsored Display & Banners',
    badge: 'Amazon Ads',
    description: 'High-CTR display banners (300×250) and headline search banners (1200×628) for Sponsored Products.',
    tags: ['300×250 Display', '1200×628 Headline'],
    icon: Target,
  },
]

export function NewProjectForm({ initialBooks }: { initialBooks?: LibraryBookItem[] }) {
  const router = useRouter()

  // Goal Selector State
  const [contentGoal, setContentGoal] = useState<ContentGoalKey>('all')

  // Input Method State: 'url' (Creatify style), 'upload' (covers + 2-5 interior pages), 'library', 'pdf'
  const [tab, setTab] = useState<'url' | 'upload' | 'library' | 'pdf'>('url')

  const [library, setLibrary] = useState<LibraryBookItem[]>(initialBooks ?? [])
  const [loadingLibrary, setLoadingLibrary] = useState(!initialBooks)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // URL Importer State (Creatify Style)
  const [productUrl, setProductUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [extractedData, setExtractedData] = useState<{
    title: string
    author: string
    blurb: string
    coverUrl: string | null
    sourceUrl: string
    rating?: number | null
    reviewCount?: number | null
  } | null>(null)

  // Book Details & Upload State (No PDF mandatory)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [blurb, setBlurb] = useState('')
  const [frontCover, setFrontCover] = useState<File | null>(null)
  const [backCover, setBackCover] = useState<File | null>(null)
  const [interiorImages, setInteriorImages] = useState<File[]>([])

  // Optional PDF Upload State
  const [pdf, setPdf] = useState<File | null>(null)

  // Campaign settings
  const [campaignName, setCampaignName] = useState('')
  const [campaignObjective, setCampaignObjective] = useState<CampaignObjectiveKey>('launch')
  const [templateKey, setTemplateKey] = useState<TemplateKey>('classic')
  const [copyTone, setCopyTone] = useState<CopyTone>('literary')
  const [ctaText, setCtaText] = useState<string>(CTA_PRESETS[0])

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBooks && initialBooks.length > 0) {
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
            setSelectedBookId(data.books[0].id)
            setCampaignName(`${data.books[0].title} - Campaign`)
          }
        }
      } catch {
        // Silent fallback
      } finally {
        setLoadingLibrary(false)
      }
    }
    load()
  }, [initialBooks])

  // Handle URL Extraction (Creatify feature)
  async function handleExtractFromUrl() {
    if (!productUrl.trim()) {
      setError('Please enter a valid Amazon, bookstore, or Goodreads link.')
      return
    }

    setFetchingUrl(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to pull book info from link.')
      }

      setExtractedData(data)
      setTitle(data.title || '')
      setAuthor(data.author || '')
      setBlurb(data.blurb || '')
      if (!campaignName || campaignName.endsWith(' - Campaign') || campaignName === 'New Campaign') {
        setCampaignName(`${data.title || 'Book'} - Campaign`)
      }
      toast.success('Book details extracted!', {
        description: `Pulled "${data.title || 'book details'}" from store listing.`,
      })
    } catch (err: any) {
      setError(err.message || 'Could not extract book details from URL. You can upload covers directly below.')
      toast.error('Could not extract link', { description: err.message })
    } finally {
      setFetchingUrl(false)
    }
  }

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

    // Flow 1: Library Book
    if (tab === 'library') {
      if (!selectedBookId) {
        setPending(false)
        setError('Please select a book from your library.')
        return
      }

      const res = await fetch('/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingBookId: selectedBookId,
          contentGoal,
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

      toast.success('Project created', { description: 'Ready to configure your creatives.' })
      router.push(`/ads/${json.id}/configure`)
      router.refresh()
      return
    }

    // Flow 2: URL Importer (Creatify Style)
    if (tab === 'url') {
      const activeTitle = title.trim() || extractedData?.title?.trim()
      if (!activeTitle && !extractedData?.coverUrl) {
        setPending(false)
        setError('Please paste a product URL and click "Pull Book Details", or switch to the manual upload tab.')
        return
      }

      // If publisher also added interior images, submit via FormData
      if (interiorImages.length > 0 || frontCover) {
        const body = new FormData()
        body.append('title', activeTitle || 'Untitled Book')
        body.append('author', author.trim() || extractedData?.author || '')
        body.append('blurb', blurb.trim() || extractedData?.blurb || '')
        body.append('contentGoal', contentGoal)
        body.append('sourceUrl', productUrl.trim() || extractedData?.sourceUrl || '')
        if (frontCover) body.append('frontCover', frontCover)
        if (backCover) body.append('backCover', backCover)
        interiorImages.forEach((img) => body.append('interiorImages', img))
        body.append('campaignName', campaignName.trim() || `${activeTitle || 'New'} - Campaign`)
        body.append('campaignObjective', campaignObjective)
        body.append('templateKey', templateKey)
        body.append('copyTone', copyTone)
        body.append('ctaText', ctaText)

        const res = await fetch('/api/ads/projects', { method: 'POST', body })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setPending(false)
          setError(json.error ?? 'Something went wrong creating your project.')
          return
        }

        toast.success('Project created', { description: 'Ready to configure and generate creatives.' })
        router.push(`/ads/${json.id}/configure`)
        router.refresh()
        return
      }

      // Otherwise send clean JSON with scraped cover URL
      const res = await fetch('/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeTitle || 'Untitled Book',
          author: author.trim() || extractedData?.author || '',
          blurb: blurb.trim() || extractedData?.blurb || '',
          frontCoverUrl: extractedData?.coverUrl || null,
          sourceUrl: productUrl.trim() || extractedData?.sourceUrl || null,
          contentGoal,
          rating: extractedData?.rating ?? null,
          reviewCount: extractedData?.reviewCount ?? null,
          campaignName: campaignName.trim() || `${activeTitle || 'New'} - Campaign`,
          campaignObjective,
          templateKey,
          copyTone,
          ctaText,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Failed to create campaign from URL.')
        return
      }

      toast.success('Project created', { description: 'Ready to configure and generate creatives.' })
      router.push(`/ads/${json.id}/configure`)
      router.refresh()
      return
    }

    // Flow 3: Upload Covers + 2-5 Interior Pages (No PDF required)
    if (tab === 'upload') {
      const activeTitle = title.trim()
      if (!activeTitle && !frontCover) {
        setPending(false)
        setError('Please enter a book title and provide a front cover image.')
        return
      }

      const body = new FormData()
      body.append('title', activeTitle || 'Untitled Book')
      body.append('author', author.trim())
      body.append('blurb', blurb.trim())
      body.append('contentGoal', contentGoal)
      if (frontCover) body.append('frontCover', frontCover)
      if (backCover) body.append('backCover', backCover)
      interiorImages.forEach((img) => body.append('interiorImages', img))
      body.append('campaignName', campaignName.trim() || `${activeTitle || 'New'} - Campaign`)
      body.append('campaignObjective', campaignObjective)
      body.append('templateKey', templateKey)
      body.append('copyTone', copyTone)
      body.append('ctaText', ctaText)

      const res = await fetch('/api/ads/projects', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Something went wrong creating your project.')
        return
      }

      if (json.needsManualCover) {
        toast.success('Book details saved', { description: 'Please add a cover image to continue.' })
        router.push(`/ads/${json.id}/upload`)
      } else {
        toast.success('Project created', { description: 'Ready to configure your creatives.' })
        router.push(`/ads/${json.id}/configure`)
      }
      router.refresh()
      return
    }

    // Flow 4: Full PDF Upload
    if (!pdf) {
      setPending(false)
      setError('Choose your book PDF to continue.')
      return
    }

    const body = new FormData()
    body.append('pdf', pdf)
    body.append('contentGoal', contentGoal)
    if (frontCover) body.append('frontCover', frontCover)
    if (backCover) body.append('backCover', backCover)
    interiorImages.forEach((img) => body.append('interiorImages', img))
    if (campaignName.trim()) body.append('campaignName', campaignName.trim())
    body.append('campaignObjective', campaignObjective)
    body.append('templateKey', templateKey)
    body.append('copyTone', copyTone)
    body.append('ctaText', ctaText)

    const res = await fetch('/api/ads/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book.')
      return
    }

    toast.success('Book uploaded', { description: 'Ready to configure and preview.' })
    router.push(`/ads/${json.id}/configure`)
    router.refresh()
  }

  const filteredLibrary = library.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="p-6 sm:p-8">
      {/* STEP 1: CONTENT GOAL SELECTOR */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold">1. What kind of content do you want to create?</h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Select your creative goal to optimize formats, image dimensions, and trailer scripts.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_GOALS.map((goal) => {
            const isSelected = contentGoal === goal.key
            const Icon = goal.icon
            return (
              <button
                key={goal.key}
                type="button"
                onClick={() => setContentGoal(goal.key)}
                className={cn(
                  'flex flex-col items-start rounded-2xl border p-4 text-left transition-all',
                  isSelected
                    ? 'border-accent bg-accent-soft/70 shadow-inset ring-2 ring-accent/30'
                    : 'border-line/70 bg-surface-2/60 hover:border-accent/40 hover:bg-surface-2'
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={cn('grid size-9 place-items-center rounded-xl', isSelected ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted')}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      isSelected ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted'
                    )}
                  >
                    {goal.badge}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink">{goal.title}</h3>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed line-clamp-2">{goal.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {goal.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* STEP 2: INPUT METHOD SELECTION */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold">2. Choose your input source</h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Paste a product URL for instant auto-extraction, or upload your book cover and internal pages.
        </p>

        {/* Tab Switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-line pb-4">
          <button
            type="button"
            onClick={() => {
              setTab('url')
              setError(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              tab === 'url'
                ? 'bg-accent text-on-accent shadow-subtle'
                : 'border border-accent/30 bg-accent-soft/30 text-ink hover:bg-accent-soft/50'
            )}
          >
            <LinkIcon className="size-4 text-accent" aria-hidden />
            Product URL
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
            <Zap className="size-4 text-amber-500" aria-hidden />
            Upload Covers & Internal Pages
            <span className="text-[11px] font-normal text-ink-muted">(No PDF required)</span>
          </button>

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
              setTab('pdf')
              setError(null)
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors text-ink-muted hover:bg-surface-2 hover:text-ink'
            )}
          >
            <FileUp className="size-4" aria-hidden />
            Upload PDF (Optional)
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {/* TAB 1: CREATIFY-STYLE URL IMPORTER */}
        {tab === 'url' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-5">
              <div className="flex items-start gap-3.5">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <div className="flex-1">
                  <h3 className="font-semibold text-ink text-sm">Instant Book Importer</h3>
                  <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                    Paste any Amazon KDP, bookstore, or Goodreads link. We will pull the book title, author, description, high-res cover, and star ratings automatically.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        placeholder="e.g. https://www.amazon.com/dp/B09XYZ... or https://goodreads.com/book/show/..."
                        className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleExtractFromUrl()
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleExtractFromUrl}
                      loading={fetchingUrl}
                      disabled={fetchingUrl || !productUrl.trim()}
                      className="shrink-0"
                    >
                      {fetchingUrl ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Pulling details…
                        </>
                      ) : (
                        <>
                          <LinkIcon className="size-4" aria-hidden />
                          Pull Book Details
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted Product Preview Card */}
            {extractedData && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Successfully Pulled from Listing
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  {extractedData.coverUrl && (
                    <div className="size-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface shadow-subtle sm:size-28">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={extractedData.coverUrl} alt="" className="size-full object-cover" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-ink">{title || extractedData.title}</h4>
                    <p className="text-xs font-medium text-ink-muted">By {author || extractedData.author || 'Author'}</p>

                    {extractedData.rating && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-amber-500">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                          {extractedData.rating.toFixed(1)} / 5
                        </span>
                        {extractedData.reviewCount && (
                          <span className="text-ink-muted">({extractedData.reviewCount.toLocaleString()} customer reviews)</span>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-ink-muted/90 line-clamp-3 leading-relaxed">
                      {blurb || extractedData.blurb || 'No blurb provided.'}
                    </p>
                  </div>
                </div>

                {/* Interior Pages Option to enrich A+ and Video scenes */}
                <div className="mt-6 border-t border-line/60 pt-5">
                  <InteriorImagesDropzone
                    files={interiorImages}
                    onFilesChange={setInteriorImages}
                    label="Optional: Add 2–5 Interior Page Images or Illustrations"
                    description="Upload maps, chapter openers, or character art to display in A+ feature modules and Remotion trailer scenes."
                  />
                </div>
              </div>
            )}

            {/* Editable Book Fields when URL is not yet pulled or needs manual edit */}
            {!extractedData && (
              <div className="flex items-start gap-3 rounded-xl border border-line/80 bg-surface-2/40 p-4 text-xs text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <p>
                  Paste your link above to auto-populate everything. If you prefer manual entry, click the <strong>"Upload Cover & 2–5 Interior Pages"</strong> tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD COVERS & 2-5 INTERIOR IMAGES (NO PDF) */}
        {tab === 'upload' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3.5 rounded-2xl border border-accent/25 bg-accent-soft/20 p-4">
              <Zap className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Lightweight & Fast Setup</p>
                <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                  No full book PDF upload is required. Provide your front cover and 2–5 interior pages (illustrations, maps, or chapter spreads) to generate Amazon A+ modules and video trailers.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="manualTitle" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Book title <span className="text-danger">*</span>
                </label>
                <input
                  id="manualTitle"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (error) setError(null)
                    if (!campaignName || campaignName.endsWith(' - Campaign') || campaignName === 'New Campaign') {
                      setCampaignName(e.target.value.trim() ? `${e.target.value.trim()} - Campaign` : '')
                    }
                  }}
                  placeholder="e.g. The Midnight Library"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="manualAuthor" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Author
                </label>
                <input
                  id="manualAuthor"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Matt Haig"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="manualBlurb" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Blurb / Hook / Synopsis
                </label>
                <textarea
                  id="manualBlurb"
                  rows={3}
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  placeholder="Back-cover copy, teaser excerpt, or hook to inspire ad headlines…"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <Dropzone
                  id="frontCover"
                  label="Front cover image (Required)"
                  rule={COVER_RULE}
                  file={frontCover}
                  onFileChange={setFrontCover}
                  compact
                />
              </div>

              <div>
                <Dropzone
                  id="backCover"
                  label="Back cover image (Optional)"
                  rule={COVER_RULE}
                  file={backCover}
                  onFileChange={setBackCover}
                  compact
                />
              </div>

              {/* 2-5 Interior Page Images */}
              <div className="sm:col-span-2 pt-2">
                <InteriorImagesDropzone
                  files={interiorImages}
                  onFilesChange={setInteriorImages}
                  label="2–5 Interior Page Images & Illustrations"
                  description="Upload chapter openers, maps, character sketches, or excerpt spreads. These are showcased in A+ feature cards and video trailer reveals."
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CHOOSE FROM LIBRARY */}
        {tab === 'library' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Select a book from your library</h2>
              <p className="text-sm text-ink-muted">
                Run another campaign or generate new A+ content without re-entering details.
              </p>
            </div>

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-10 text-sm text-ink-muted">
                Loading your book library…
              </div>
            ) : library.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
                <BookOpen className="size-8 text-ink-muted" aria-hidden />
                <p className="mt-3 font-medium">No books in library yet</p>
                <p className="mt-1 text-sm text-ink-muted">Paste an Amazon link or upload your covers above to start.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={() => setTab('url')}>
                    Paste Amazon Link
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setTab('upload')}>
                    Upload Covers & Pages
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

        {/* TAB 4: OPTIONAL PDF UPLOAD */}
        {tab === 'pdf' && (
          <div className="flex flex-col gap-6">
            <Dropzone id="pdf" label="Full Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Dropzone id="frontCoverPdf" label="Front cover" rule={COVER_RULE} file={frontCover} onFileChange={setFrontCover} compact />
              <Dropzone id="backCoverPdf" label="Back cover" rule={COVER_RULE} file={backCover} onFileChange={setBackCover} compact />
            </div>
          </div>
        )}

        {/* CAMPAIGN SETTINGS & CUSTOM STYLES */}
        <div className="flex flex-col gap-6 rounded-2xl border border-line/60 bg-surface-2/60 p-5">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-accent" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Campaign Customization & Visual Aesthetic</h3>
          </div>

          <div>
            <label htmlFor="campaignName" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Campaign Label
            </label>
            <input
              id="campaignName"
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder={title ? `${title} - Campaign` : 'e.g. Launch Campaign'}
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Target className="size-3.5" aria-hidden /> Campaign Strategy & Promotional Objective
            </span>
            <CustomCampaignPicker
              campaignObjective={campaignObjective}
              onObjectiveChange={setCampaignObjective}
              campaignName={campaignName}
              onCampaignNameChange={setCampaignName}
              ctaText={ctaText}
              onCtaTextChange={setCtaText}
              bookTitle={title || extractedData?.title || 'Book Title'}
            />
          </div>

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Palette className="size-3.5" aria-hidden /> Visual Aesthetic & Color Palette
            </span>
            <CustomPalettePicker
              value={templateKey}
              onChange={setTemplateKey}
              bookTitle={title || extractedData?.title || 'Book Title'}
              coverUrl={extractedData?.coverUrl || null}
              badgeText={getCampaignObjective(campaignObjective).badge}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> Safe and private to your publisher workspace.
          </p>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={
              pending ||
              (tab === 'pdf' && !pdf) ||
              (tab === 'library' && (!selectedBookId || library.length === 0)) ||
              (tab === 'upload' && !title.trim() && !frontCover) ||
              (tab === 'url' && !extractedData && !title.trim() && !frontCover)
            }
          >
            {pending
              ? 'Setting up project…'
              : tab === 'library'
                ? 'Create project for book'
                : tab === 'url'
                  ? 'Continue to configure'
                  : 'Create project and continue'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
