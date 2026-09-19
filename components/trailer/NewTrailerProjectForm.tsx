'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  FileUp,
  Info,
  Library,
  Link as LinkIcon,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { InteriorImagesDropzone } from '@/components/platform/InteriorImagesDropzone'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import {
  STYLE_OPTIONS,
  LENGTH_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  type TrailerStyle,
  type TrailerLength,
  type TrailerAspectRatio,
  type TrailerMusicMood,
} from '@/lib/services/trailer/options'

export interface TrailerLibraryBookItem {
  id: string
  title: string
  author: string
  blurb: string
  frontCoverUrl: string | null
  createdAt: string | Date
  source?: 'book' | 'trailer'
}

export function NewTrailerProjectForm({ initialBooks }: { initialBooks?: TrailerLibraryBookItem[] }) {
  const router = useRouter()
  // Tabs: 'url' (Creatify URL-to-Video), 'quick' (Covers + 2-5 Interior Pages), 'library', 'upload' (PDF)
  const [tab, setTab] = useState<'url' | 'quick' | 'library' | 'upload'>('url')

  const [library, setLibrary] = useState<TrailerLibraryBookItem[]>(initialBooks ?? [])
  const [loadingLibrary, setLoadingLibrary] = useState(!initialBooks)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(
    initialBooks && initialBooks.length > 0 ? initialBooks[0].id : null
  )
  const [searchQuery, setSearchQuery] = useState('')

  // URL-to-Video State (Creatify Style)
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

  // Manual Details & 2-5 Interior Pages
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [blurb, setBlurb] = useState('')
  const [frontCover, setFrontCover] = useState<File | null>(null)
  const [backCover, setBackCover] = useState<File | null>(null)
  const [interiorImages, setInteriorImages] = useState<File[]>([])

  // Optional PDF State
  const [pdf, setPdf] = useState<File | null>(null)

  // Trailer presets
  const [style, setStyle] = useState<TrailerStyle>('cinematic')
  const [length, setLength] = useState<TrailerLength>('30s')
  const [aspectRatios, setAspectRatios] = useState<TrailerAspectRatio[]>(['9:16', '1:1', '16:9'])
  const [musicMood] = useState<TrailerMusicMood>('suspenseful')

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBooks && initialBooks.length > 0) return

    async function load() {
      try {
        const res = await fetch('/api/trailer/library')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.books) && data.books.length > 0) {
            setLibrary(data.books)
            setSelectedBookId(data.books[0].id)
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoadingLibrary(false)
      }
    }
    load()
  }, [initialBooks])

  const toggleAspectRatio = (ar: TrailerAspectRatio) => {
    setAspectRatios((prev) =>
      prev.includes(ar) ? (prev.length > 1 ? prev.filter((k) => k !== ar) : prev) : [...prev, ar]
    )
  }

  // Creatify-style URL scraper
  async function handleExtractFromUrl() {
    if (!productUrl.trim()) {
      setError('Please paste a valid product link.')
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
        throw new Error(data.error || 'Failed to extract book details from URL.')
      }

      setExtractedData(data)
      setTitle(data.title || '')
      setAuthor(data.author || '')
      setBlurb(data.blurb || '')
      toast.success('Book details extracted!', {
        description: `Pulled "${data.title || 'book details'}" for video trailer.`,
      })
    } catch (err: any) {
      setError(err.message || 'Could not extract details from link. You can enter details manually below.')
      toast.error('Extraction failed', { description: err.message })
    } finally {
      setFetchingUrl(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    // Mode 1: URL-to-Video (Creatify Style)
    if (tab === 'url') {
      const activeTitle = title.trim() || extractedData?.title?.trim()
      if (!activeTitle && !extractedData?.coverUrl) {
        setPending(false)
        setError('Please paste an Amazon or product URL and click "Pull Book Details", or switch to manual upload.')
        return
      }

      if (interiorImages.length > 0 || frontCover) {
        const body = new FormData()
        body.append('title', activeTitle || 'Untitled Book')
        body.append('author', author.trim() || extractedData?.author || '')
        body.append('blurb', blurb.trim() || extractedData?.blurb || '')
        body.append('sourceUrl', productUrl.trim() || extractedData?.sourceUrl || '')
        if (frontCover) body.append('frontCover', frontCover)
        if (backCover) body.append('backCover', backCover)
        interiorImages.forEach((img) => body.append('interiorImages', img))
        body.append('style', style)
        body.append('length', length)
        body.append('musicMood', musicMood)
        aspectRatios.forEach((ar) => body.append('aspectRatios', ar))

        const res = await fetch('/api/trailer/projects', { method: 'POST', body })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setPending(false)
          setError(json.error ?? 'Failed to create trailer project.')
          return
        }

        toast.success('Trailer project created', { description: 'Ready to preview and configure scene cuts.' })
        router.push(`/trailer/${json.id}/configure`)
        router.refresh()
        return
      }

      const res = await fetch('/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeTitle || 'Untitled Book',
          author: author.trim() || extractedData?.author || '',
          blurb: blurb.trim() || extractedData?.blurb || '',
          frontCoverUrl: extractedData?.coverUrl || null,
          sourceUrl: productUrl.trim() || extractedData?.sourceUrl || null,
          style,
          length,
          musicMood,
          aspectRatios,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Failed to create trailer project.')
        return
      }

      toast.success('Trailer project created', { description: 'Ready to preview and configure scene cuts.' })
      router.push(`/trailer/${json.id}/configure`)
      router.refresh()
      return
    }

    // Mode 2: Quick Setup with Covers & 2-5 Interior Pages (No PDF)
    if (tab === 'quick') {
      const activeTitle = title.trim()
      if (!activeTitle && !frontCover) {
        setPending(false)
        setError('Please enter a book title and provide a cover image.')
        return
      }

      const body = new FormData()
      body.append('title', activeTitle || 'Untitled Book')
      body.append('author', author.trim())
      body.append('blurb', blurb.trim())
      if (frontCover) body.append('frontCover', frontCover)
      if (backCover) body.append('backCover', backCover)
      interiorImages.forEach((img) => body.append('interiorImages', img))
      body.append('style', style)
      body.append('length', length)
      body.append('musicMood', musicMood)
      aspectRatios.forEach((ar) => body.append('aspectRatios', ar))

      const res = await fetch('/api/trailer/projects', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Something went wrong creating your trailer.')
        return
      }

      if (json.needsManualCover) {
        toast.success('Book details saved', { description: 'Please add a cover image to render your trailer video.' })
        router.push(`/trailer/${json.id}/upload`)
      } else {
        toast.success('Trailer project created', { description: 'Ready to preview and configure scene cuts.' })
        router.push(`/trailer/${json.id}/configure`)
      }
      router.refresh()
      return
    }

    // Mode 3: Choose from Library
    if (tab === 'library') {
      if (!selectedBookId) {
        setPending(false)
        setError('Please select a book from your library.')
        return
      }

      const res = await fetch('/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingBookId: selectedBookId,
          style,
          length,
          musicMood,
          aspectRatios,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Failed to create trailer from selected book.')
        return
      }

      toast.success('Book selected', { description: 'Ready to configure and preview your trailer.' })
      router.push(`/trailer/${json.id}/configure`)
      router.refresh()
      return
    }

    // Mode 4: PDF Upload
    if (!pdf) {
      setPending(false)
      setError('Choose your book PDF to continue.')
      return
    }

    const body = new FormData()
    body.append('pdf', pdf)
    if (frontCover) body.append('frontCover', frontCover)
    if (backCover) body.append('backCover', backCover)
    interiorImages.forEach((img) => body.append('interiorImages', img))
    body.append('style', style)
    body.append('length', length)
    body.append('musicMood', musicMood)

    const res = await fetch('/api/trailer/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book.')
      return
    }

    toast.success('Book uploaded', { description: 'Check the details we found, then configure your trailer.' })
    router.push(`/trailer/${json.id}/configure`)
    router.refresh()
  }

  const filteredLibrary = library.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="p-6 sm:p-8">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-xl font-bold">New Video Trailer Project</h2>
        </div>
        <p className="text-sm text-ink-muted">
          Turn your book into a cinematic trailer with dynamic Remotion typography, hyperframes lighting, and multi-ratio exports.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
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
            setTab('quick')
            setError(null)
          }}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'quick'
              ? 'bg-accent text-on-accent shadow-subtle'
              : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          )}
        >
          <Zap className="size-4 text-amber-500" aria-hidden />
          Upload Covers & Internal Pages
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
            setTab('upload')
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

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {/* TAB 1: PRODUCT URL */}
        {tab === 'url' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-5">
              <div className="flex items-start gap-3.5">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <div className="flex-1">
                  <h3 className="font-semibold text-ink text-sm">Product URL</h3>
                  <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                    Paste an Amazon product page, bookstore, or Goodreads link. We pull the book cover, author, hook, and blurb to automatically build your Remotion trailer scenes.
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

            {extractedData && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 transition-all">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Ready to Render Trailer
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
                          <span className="text-ink-muted">({extractedData.reviewCount.toLocaleString()} reviews on Amazon)</span>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-ink-muted/90 line-clamp-3 leading-relaxed">
                      {blurb || extractedData.blurb || 'No blurb provided.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 border-t border-line/60 pt-5">
                  <InteriorImagesDropzone
                    files={interiorImages}
                    onFilesChange={setInteriorImages}
                    label="Optional: Add Internal Page Images or Illustrations"
                    description="Include maps, excerpt spreads, or character art to feature in Scene 2 (Excerpt) and Scene 3 (Book Reveal)."
                  />
                </div>
              </div>
            )}

            {!extractedData && (
              <div className="flex items-start gap-3 rounded-xl border border-line/80 bg-surface-2/40 p-4 text-xs text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <p>
                  Enter any book product link above to auto-extract details. If you have your cover file on your device, switch to the <strong>"Upload Covers & Internal Pages"</strong> tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUICK SETUP (NO PDF) */}
        {tab === 'quick' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3.5 rounded-2xl border border-accent/25 bg-accent-soft/20 p-4">
              <Zap className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Lightweight & Fast Setup</p>
                <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                  No full book PDF upload needed. Provide your cover and up to 5 internal pages (chapter openers, maps, character art) to render cinematic trailer scenes.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="trailerTitle" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Book title <span className="text-danger">*</span>
                </label>
                <input
                  id="trailerTitle"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="e.g. The Midnight Library"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="trailerAuthor" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Author
                </label>
                <input
                  id="trailerAuthor"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Matt Haig"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="trailerBlurb" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Story Hook / Excerpt
                </label>
                <textarea
                  id="trailerBlurb"
                  rows={3}
                  value={blurb}
                  onChange={(e) => setBlurb(e.target.value)}
                  placeholder="A teaser sentence, synopsis excerpt, or tagline featured in Scene 2…"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <Dropzone
                  id="trailerFrontCover"
                  label="Front cover image (Required)"
                  rule={COVER_RULE}
                  file={frontCover}
                  onFileChange={setFrontCover}
                  compact
                />
              </div>

              <div>
                <Dropzone
                  id="trailerBackCover"
                  label="Back cover image (Optional)"
                  rule={COVER_RULE}
                  file={backCover}
                  onFileChange={setBackCover}
                  compact
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <InteriorImagesDropzone
                  files={interiorImages}
                  onFilesChange={setInteriorImages}
                  label="Internal Page Images & Illustrations"
                  description="Upload chapter openers, maps, character sketches, or excerpt spreads to display in the trailer scenes."
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIBRARY SELECTOR */}
        {tab === 'library' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Select a book from your library</h2>
              <p className="text-sm text-ink-muted">
                Create a cinematic trailer for a previously uploaded book without re-entering details.
              </p>
            </div>

            {loadingLibrary ? (
              <div className="flex items-center justify-center py-10 text-sm text-ink-muted">
                Loading your book library…
              </div>
            ) : library.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center">
                <BookOpen className="size-8 text-ink-muted" aria-hidden />
                <p className="mt-3 font-medium">No books in your library yet</p>
                <p className="mt-1 text-sm text-ink-muted">Start by pasting a product link or uploading your covers.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={() => setTab('url')}>
                    URL to Video
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setTab('quick')}>
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
                        onClick={() => setSelectedBookId(b.id)}
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
                          <p className="truncate text-xs text-ink-muted">{b.author || 'Unknown author'}</p>
                          {b.blurb && (
                            <p className="mt-1 line-clamp-1 text-xs text-ink-muted/80">{b.blurb}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PDF UPLOAD */}
        {tab === 'upload' && (
          <div className="flex flex-col gap-6">
            <Dropzone id="trailerPdf" label="Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Dropzone id="trailerFrontCoverPdf" label="Front cover" rule={COVER_RULE} file={frontCover} onFileChange={setFrontCover} compact />
              <Dropzone id="trailerBackCoverPdf" label="Back cover" rule={COVER_RULE} file={backCover} onFileChange={setBackCover} compact />
            </div>
          </div>
        )}

        {/* SHARED INITIAL TRAILER SETTINGS */}
        <div className="border-t border-line pt-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">
              Trailer Visual Direction & Formats
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Customize motion style and video aspect ratios (supports multi-format batch generation).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-ink-muted">Motion Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as TrailerStyle)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({s.tagline})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted">Trailer Duration</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as TrailerLength)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {LENGTH_OPTIONS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label} ({l.durationSec}s)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted">Aspect Ratios</label>
              <div className="mt-1.5 flex items-center gap-1.5">
                {ASPECT_RATIO_OPTIONS.map((ar) => {
                  const active = aspectRatios.includes(ar.key)
                  return (
                    <button
                      key={ar.key}
                      type="button"
                      onClick={() => toggleAspectRatio(ar.key)}
                      className={cn(
                        'flex-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all text-center',
                        active
                          ? 'border-accent bg-accent-soft text-accent shadow-subtle'
                          : 'border-line/60 bg-surface-2 text-ink-muted hover:border-line'
                      )}
                    >
                      {ar.key}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> All assets and trailers remain private to your workspace.
          </p>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={
              pending ||
              (tab === 'upload' && !pdf) ||
              (tab === 'library' && (!selectedBookId || library.length === 0)) ||
              (tab === 'quick' && !title.trim() && !frontCover) ||
              (tab === 'url' && !extractedData && !title.trim() && !frontCover)
            }
          >
            <Clapperboard className="size-4" aria-hidden />
            {pending
              ? 'Setting up trailer…'
              : tab === 'url'
                ? 'Create trailer and preview'
                : tab === 'quick'
                  ? 'Create trailer and preview'
                  : 'Continue to studio'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
