'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LayoutTemplate, UploadCloud, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea, Field } from '@/components/ui/field'
import { Dropzone } from '@/components/platform/Dropzone'
import { PDF_RULE, COVER_RULE } from '@/lib/services/ads/validation'

export function NewLandingProjectForm() {
  const router = useRouter()
  const [tab, setTab] = useState<'pdf' | 'manual'>('pdf')
  const [pdf, setPdf] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [author, setAuthor] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    if (tab === 'pdf') {
      if (!pdf) {
        setError('Please select a book PDF file.')
        setPending(false)
        return
      }

      const body = new FormData()
      body.append('pdf', pdf)
      if (cover) body.append('cover', cover)

      const res = await fetch('/api/landing/projects', {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        setPending(false)
        const message = (await res.json().catch(() => ({}))).error ?? 'Failed to upload book.'
        setError(message)
        toast.error(message)
        return
      }

      const { id } = await res.json()
      toast.success('Book assets extracted and landing project created!')
      router.push(`/landing/${id}/configure`)
      return
    }

    if (!title.trim() || !author.trim()) {
      setError('Title and author are required.')
      setPending(false)
      return
    }

    const res = await fetch('/api/landing/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subtitle,
        author,
        synopsis,
      }),
    })

    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'Failed to create project.'
      setError(message)
      toast.error(message)
      return
    }

    const { id } = await res.json()
    toast.success('Landing project created!')
    router.push(`/landing/${id}/configure`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* Mode Switcher */}
      <div className="flex rounded-xl bg-surface-2 p-1 self-start border border-line/60">
        <button
          type="button"
          onClick={() => setTab('pdf')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'pdf' ? 'bg-surface text-ink shadow-subtle ring-1 ring-accent/30 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <UploadCloud className="size-4 text-accent" />
          <span>Upload Book PDF</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'manual' ? 'bg-surface text-ink shadow-subtle ring-1 ring-accent/30 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <FileText className="size-4 text-accent" />
          <span>Enter Details Manually</span>
        </button>
      </div>

      {tab === 'pdf' ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <UploadCloud className="size-4 text-accent" /> Book PDF
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              We extract title, author, blurb, cover art, and sample chapter text automatically.
            </p>
            <div className="mt-4">
              <Dropzone
                id="lp-pdf-dropzone"
                label="Drop book PDF here"
                rule={PDF_RULE}
                file={pdf}
                onFileChange={setPdf}
                hint="PDF up to 25MB"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <ImageIcon className="size-4 text-accent" /> Cover Artwork (Optional)
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              High-resolution cover image for 3D hero showcase and social OpenGraph tags.
            </p>
            <div className="mt-4">
              <Dropzone
                id="lp-cover-dropzone"
                label="Drop book cover image here"
                rule={COVER_RULE}
                file={cover}
                onFileChange={setCover}
                hint="PNG, JPEG or WebP up to 10MB"
              />
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <h3 className="font-display text-base font-semibold">Book Details</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Enter your book metadata to generate your landing page.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Book Title" htmlFor="lp-title">
              <Input
                id="lp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Obsidian Throne"
                required
              />
            </Field>
            <Field label="Author Name" htmlFor="lp-author">
              <Input
                id="lp-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="A. R. Sterling"
                required
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Subtitle / Hook Tagline" htmlFor="lp-subtitle">
              <Input
                id="lp-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="An epic fantasy novel of ancient prophecies and forgotten kings."
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Book Synopsis" htmlFor="lp-synopsis">
              <Textarea
                id="lp-synopsis"
                rows={5}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="When the shadows lengthen over the eastern kingdom..."
              />
            </Field>
          </div>
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="lg" loading={pending} disabled={tab === 'pdf' ? !pdf : !title.trim() || !author.trim()}>
          <Sparkles className="size-4" /> Create Landing Project
        </Button>
      </div>
    </form>
  )
}
