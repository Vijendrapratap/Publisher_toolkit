'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'

export function NewProjectForm() {
  const router = useRouter()
  const [pdf, setPdf] = useState<File | null>(null)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [showCovers, setShowCovers] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pdf) {
      setError('Choose your book PDF to continue.')
      return
    }
    setPending(true)
    setError(null)
    const body = new FormData()
    body.append('pdf', pdf)
    if (front) body.append('frontCover', front)
    if (back) body.append('backCover', back)

    const res = await fetch('/api/ads/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book. Please try again.')
      return
    }
    toast.success('Book uploaded', { description: 'Check the details we found, then continue.' })
    router.push(`/ads/${json.id}/upload`)
    router.refresh()
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
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

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> Your files stay private to your account.
          </p>
          <Button type="submit" size="lg" loading={pending} disabled={!pdf}>
            {pending ? 'Reading your book…' : 'Upload and continue'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
