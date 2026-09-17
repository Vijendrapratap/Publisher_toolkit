'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Headphones, UploadCloud, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Textarea, Field } from '@/components/ui/field'
import { Dropzone } from '@/components/platform/Dropzone'
import { PDF_RULE, COVER_RULE } from '@/lib/services/ads/validation'

export function NewAudiobookProjectForm() {
  const router = useRouter()
  const [tab, setTab] = useState<'pdf' | 'paste'>('pdf')
  const [pdf, setPdf] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [blurb, setBlurb] = useState('')
  const [manuscriptText, setManuscriptText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    if (tab === 'pdf') {
      if (!pdf) {
        setError('Please select a PDF manuscript file.')
        setPending(false)
        return
      }

      const body = new FormData()
      body.append('pdf', pdf)
      if (cover) body.append('cover', cover)

      const res = await fetch('/api/audiobook/projects', {
        method: 'POST',
        body,
      })

      if (!res.ok) {
        setPending(false)
        const message = (await res.json().catch(() => ({}))).error ?? 'Failed to upload manuscript.'
        setError(message)
        toast.error(message)
        return
      }

      const { id } = await res.json()
      toast.success('Manuscript uploaded and chapters detected!')
      router.push(`/audiobook/${id}/configure`)
      return
    }

    // Text paste tab
    if (!title.trim() || !manuscriptText.trim()) {
      setError('Title and manuscript text are required.')
      setPending(false)
      return
    }

    const res = await fetch('/api/audiobook/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        author,
        blurb,
        manuscriptText,
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
    toast.success('Project created and chapters parsed!')
    router.push(`/audiobook/${id}/configure`)
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
          <span>Upload PDF Manuscript</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('paste')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'paste' ? 'bg-surface text-ink shadow-subtle ring-1 ring-accent/30 font-semibold' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <FileText className="size-4 text-accent" />
          <span>Paste Manuscript Text</span>
        </button>
      </div>

      {tab === 'pdf' ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <UploadCloud className="size-4 text-accent" /> Manuscript PDF
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              We extract text, chapter structure, title, author, and book cover automatically.
            </p>
            <div className="mt-4">
              <Dropzone
                id="ab-pdf-dropzone"
                label="Drop manuscript PDF here"
                rule={PDF_RULE}
                file={pdf}
                onFileChange={setPdf}
                hint="PDF up to 25MB"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <ImageIcon className="size-4 text-accent" /> Album Cover Art (Optional)
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Optional cover image used for the audiobook player, chapter packaging, and metadata.
            </p>
            <div className="mt-4">
              <Dropzone
                id="ab-cover-dropzone"
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
          <h3 className="font-display text-base font-semibold">Manuscript Details & Chapters</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Enter your book metadata and paste your manuscript. We automatically detect chapters (e.g. Chapter 1, Prologue).
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Book Title" htmlFor="ab-title">
              <Input
                id="ab-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Chronicles of Eternity"
                required
              />
            </Field>
            <Field label="Author Name" htmlFor="ab-author">
              <Input
                id="ab-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Arthur C. Vance"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Book Blurb / Tagline" htmlFor="ab-blurb" hint="Optional summary for audiobook metadata">
              <Input
                id="ab-blurb"
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder="An epic journey into the uncharted stars..."
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Manuscript Text & Chapters"
              htmlFor="ab-text"
              hint="Paste chapter headings (e.g. 'Chapter 1: The Beginning') followed by the narrative content."
            >
              <Textarea
                id="ab-text"
                rows={10}
                value={manuscriptText}
                onChange={(e) => setManuscriptText(e.target.value)}
                placeholder={"Chapter 1: The Gathering\n\nThe morning bells echoed across the valley..."}
                required
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
        <Button type="submit" size="lg" loading={pending} disabled={tab === 'pdf' ? !pdf : !title.trim() || !manuscriptText.trim()}>
          <Sparkles className="size-4" /> Parse chapters & configure voice
        </Button>
      </div>
    </form>
  )
}
