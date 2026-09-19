'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookOpen,
  ChevronDown,
  Clapperboard,
  FileUp,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
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
  const [tab, setTab] = useState<'library' | 'quick' | 'upload'>(
    initialBooks && initialBooks.length > 0 ? 'library' : 'quick'
  )
  const [library, setLibrary] = useState<TrailerLibraryBookItem[]>(initialBooks ?? [])
  const [loadingLibrary, setLoadingLibrary] = useState(!initialBooks)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(
    initialBooks && initialBooks.length > 0 ? initialBooks[0].id : null
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Quick setup state
  const [quickTitle, setQuickTitle] = useState('')
  const [quickAuthor, setQuickAuthor] = useState('')
  const [quickBlurb, setQuickBlurb] = useState('')
  const [quickCover, setQuickCover] = useState<File | null>(null)

  // Trailer presets
  const [style, setStyle] = useState<TrailerStyle>('cinematic')
  const [length, setLength] = useState<TrailerLength>('30s')
  const [aspectRatios, setAspectRatios] = useState<TrailerAspectRatio[]>(['9:16', '1:1', '16:9'])
  const [musicMood] = useState<TrailerMusicMood>('suspenseful')

  // PDF upload state
  const [pdf, setPdf] = useState<File | null>(null)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [showCovers, setShowCovers] = useState(false)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBooks) return

    async function load() {
      try {
        const res = await fetch('/api/trailer/library')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.books) && data.books.length > 0) {
            setLibrary(data.books)
            setTab('library')
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    // Mode 1: Choose from Library
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

    // Mode 2: Quick setup (No PDF)
    if (tab === 'quick') {
      const titleToUse = quickTitle.trim()
      if (!titleToUse && !quickCover) {
        setPending(false)
        setError('Please enter a book title to create your trailer.')
        return
      }

      const body = new FormData()
      body.append('title', titleToUse || 'Untitled Book')
      body.append('author', quickAuthor.trim())
      body.append('blurb', quickBlurb.trim())
      if (quickCover) body.append('frontCover', quickCover)
      body.append('style', style)
      body.append('length', length)
      body.append('musicMood', musicMood)
      aspectRatios.forEach((ar) => body.append('aspectRatios', ar))

      const res = await fetch('/api/trailer/projects', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPending(false)
        setError(json.error ?? 'Something went wrong creating your trailer. Please try again.')
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

    // Mode 3: PDF Upload
    if (!pdf) {
      setPending(false)
      setError('Choose your book PDF to continue.')
      return
    }

    const body = new FormData()
    body.append('pdf', pdf)
    if (front) body.append('frontCover', front)
    if (back) body.append('backCover', back)
    body.append('style', style)
    body.append('length', length)
    body.append('musicMood', musicMood)

    const res = await fetch('/api/trailer/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book. Please try again.')
      return
    }

    toast.success('Book uploaded', { description: 'Check the details we found, then configure your trailer.' })
    router.push(`/trailer/${json.id}/upload`)
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
        {/* Tab 1: Library Selector */}
        {tab === 'library' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Select a book from your library</h2>
              <p className="text-sm text-ink-muted">
                Create a cinematic trailer for a previously uploaded book without waiting for PDF extraction.
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
                <p className="mt-1 text-sm text-ink-muted">Start with quick setup or upload your first book PDF.</p>
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

        {/* Tab 2: Quick Setup */}
        {tab === 'quick' && (
          <div className="flex flex-col gap-6">
            {/* Reassuring Banner */}
            <div className="flex items-start gap-3.5 rounded-2xl border border-accent/25 bg-accent-soft/30 p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Token-efficient & fast setup</p>
                <p className="mt-0.5 text-xs text-ink-muted leading-relaxed">
                  Skip uploading large PDF files. All you need for video trailers is the book title, a blurb or hook, and your cover image.
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
                    setQuickTitle(e.target.value)
                    if (error) setError(null)
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
                  Blurb / Hook / Story Excerpt
                </label>
                <textarea
                  id="quickBlurb"
                  rows={4}
                  value={quickBlurb}
                  onChange={(e) => setQuickBlurb(e.target.value)}
                  placeholder="A teaser sentence, synopsis excerpt, or tagline featured in the video trailer…"
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

        {/* Tab 3: PDF Upload */}
        {tab === 'upload' && (
          <div className="flex flex-col gap-6">
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

        {/* Shared Quick Settings (Style, Length, Aspect Ratios) */}
        <div className="mt-2 border-t border-line pt-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Initial Trailer Settings
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              You can fine-tune motion scenes, music, and subtitles in the next step.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-ink-muted">Visual Style</label>
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
              <label className="text-xs font-medium text-ink-muted">Trailer Length</label>
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
            <ShieldCheck className="size-4" aria-hidden /> Your files and story metadata stay private.
          </p>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={
              (tab === 'upload' && !pdf) ||
              (tab === 'library' && (!selectedBookId || library.length === 0)) ||
              (tab === 'quick' && !quickTitle.trim() && !quickCover)
            }
          >
            <Clapperboard className="size-4" aria-hidden />
            {pending
              ? tab === 'upload'
                ? 'Reading your book…'
                : 'Preparing trailer studio…'
              : tab === 'library'
                ? 'Continue with selected book'
                : tab === 'quick'
                  ? 'Create trailer and preview'
                  : 'Upload and continue'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
