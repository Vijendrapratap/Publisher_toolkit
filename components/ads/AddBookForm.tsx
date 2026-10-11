'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { InteriorImagesDropzone } from '@/components/platform/InteriorImagesDropzone'
import { buildCoverUploadForm } from '@/lib/services/ads/addBook'
import { COVER_RULE, PDF_RULE } from '@/lib/services/shared/upload'

type Mode = 'link' | 'upload' | 'pdf'

interface Extracted {
  title: string
  author: string
  blurb: string
  coverUrl: string | null
  sourceUrl: string
  rating?: number | null
  reviewCount?: number | null
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'link', label: 'Paste a store link' },
  { key: 'upload', label: 'Upload a cover' },
  { key: 'pdf', label: 'Upload a PDF' },
]

const inputClass = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5'

export function AddBookForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('link')
  const [url, setUrl] = useState('')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [insidePages, setInsidePages] = useState<File[]>([])
  const [pdf, setPdf] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getDetails() {
    if (!url.trim()) return setError('Paste a link to your book first.')
    setPending(true)
    setError(null)
    const res = await fetch('/api/extract-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setPending(false)
    if (!res.ok) return setError(json.error ?? 'We couldn’t read that link. Try uploading a cover instead.')
    setExtracted(json)
    setTitle(json.title ?? '')
    setAuthor(json.author ?? '')
  }

  async function create(body: BodyInit, isJson: boolean) {
    setPending(true)
    setError(null)
    const res = await fetch('/api/ads/projects', {
      method: 'POST',
      body,
      headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      return setError(json.error ?? 'Something went wrong adding your book.')
    }
    router.push(json.needsManualCover ? `/ads/${json.id}/upload` : `/ads/books/${json.id}`)
    router.refresh()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'link') {
      if (!extracted) return void getDetails()
      return void create(
        JSON.stringify({
          title: title.trim() || extracted.title,
          author: author.trim(),
          blurb: extracted.blurb,
          frontCoverUrl: extracted.coverUrl,
          sourceUrl: extracted.sourceUrl,
          rating: extracted.rating ?? null,
          reviewCount: extracted.reviewCount ?? null,
        }),
        true
      )
    }
    if (mode === 'upload') {
      if (!cover || !title.trim()) return setError('Add a cover image and the book title.')
      return void create(buildCoverUploadForm({ title, author, cover, insidePages }), false)
    }
    if (!pdf) return setError('Choose your book PDF.')
    const form = new FormData()
    form.append('pdf', pdf)
    void create(form, false)
  }

  const showDetails = mode === 'upload' || (mode === 'link' && extracted)

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div role="tablist" aria-label="How to add your book" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => {
                setMode(m.key)
                setError(null)
              }}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                mode === m.key ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-muted hover:text-ink'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'link' && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Amazon or Goodreads link
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setExtracted(null)
              }}
              placeholder="https://www.amazon.com/dp/…"
            />
          </label>
        )}

        {mode === 'link' && extracted?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={extracted.coverUrl} alt="Cover found at that link" className="h-40 w-auto self-start rounded-lg shadow-card" />
        )}

        {mode === 'upload' && (
          <>
            <Dropzone id="frontCover" label="Cover image" rule={COVER_RULE} file={cover} onFileChange={setCover} compact />
            <InteriorImagesDropzone
              files={insidePages}
              onFilesChange={setInsidePages}
              label="Inside pages (optional)"
              description="Add 2–5 pages or illustrations. They make your A+ images and video ad richer."
            />
          </>
        )}

        {showDetails && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Book title
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Author
              <input className={inputClass} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
          </div>
        )}

        {mode === 'pdf' && <Dropzone id="pdf" label="Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} className="self-start">
          {mode === 'link' && !extracted ? 'Get details' : 'Add this book'}
        </Button>
      </form>
    </Card>
  )
}
