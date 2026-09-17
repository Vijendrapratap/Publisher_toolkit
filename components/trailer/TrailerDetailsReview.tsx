'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE } from '@/lib/services/ads/validation'

export function TrailerDetailsReview({
  projectId,
  initial,
  coverUrl,
}: {
  projectId: string
  initial: { title: string; author: string; blurb: string }
  coverUrl: string | null
}) {
  const router = useRouter()
  const [details, setDetails] = useState(initial)
  const [newCover, setNewCover] = useState<File | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsCover = !coverUrl

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (needsCover && !newCover) {
      setError('Add a front cover to continue.')
      return
    }
    setPending(true)
    setError(null)

    if (newCover) {
      const body = new FormData()
      body.append('frontCover', newCover)
      const res = await fetch(`/api/trailer/projects/${projectId}`, { method: 'PATCH', body })
      if (!res.ok) {
        setPending(false)
        setError((await res.json().catch(() => ({}))).error ?? 'We couldn’t save that cover. Please try again.')
        return
      }
    }

    const res = await fetch(`/api/trailer/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    })
    if (!res.ok) {
      setPending(false)
      setError((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your details. Please try again.')
      return
    }

    toast.success('Details saved')
    router.push(`/trailer/${projectId}/configure`)
    router.refresh()
  }

  const set = (key: keyof typeof details) => (value: string) => setDetails((d) => ({ ...d, [key]: value }))

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[18rem_1fr]" noValidate>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-semibold">Cover art</h2>
        {needsCover ? (
          <>
            <p className="flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              We couldn’t find a cover in your PDF. Add one to continue.
            </p>
            <Dropzone id="frontCover" label="Front cover" rule={COVER_RULE} file={newCover} onFileChange={setNewCover} compact />
          </>
        ) : replacing ? (
          <Dropzone id="frontCover" label="New front cover" rule={COVER_RULE} file={newCover} onFileChange={setNewCover} compact />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`Cover of ${details.title || 'your book'}`} className="w-full rounded-xl shadow-card" />
            <Button type="button" variant="secondary" size="sm" onClick={() => setReplacing(true)}>
              Replace cover
            </Button>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Book details</h2>
          <p className="text-sm text-ink-muted">
            These appear on title cards, quotes, and credits throughout your video trailer.
          </p>
        </div>
        <Field label="Title" htmlFor="title">
          <Input id="title" value={details.title} onChange={(e) => set('title')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Author" htmlFor="author">
          <Input id="author" value={details.author} onChange={(e) => set('author')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Blurb / Hook" htmlFor="blurb" hint="A teaser sentence or synopsis excerpt featured in the trailer.">
          <Textarea id="blurb" rows={6} value={details.blurb} onChange={(e) => set('blurb')(e.target.value)} maxLength={2000} />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} className="self-end">
          Save and configure <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Card>
    </form>
  )
}
