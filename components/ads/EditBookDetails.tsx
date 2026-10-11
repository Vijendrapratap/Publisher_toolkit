'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function EditBookDetails({ rootId, title, author }: { rootId: string; title: string; author: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [values, setValues] = useState({ title, author })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    const res = await fetch(`/api/ads/projects/${rootId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: values.title.trim(), author: values.author.trim() }),
    })
    setPending(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save those details.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          className="rounded-xl border border-line bg-surface px-3 py-2"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Author
        <input
          className="rounded-xl border border-line bg-surface px-3 py-2"
          value={values.author}
          onChange={(e) => setValues((v) => ({ ...v, author: e.target.value }))}
        />
      </label>
      <Button type="submit" size="sm" loading={pending}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}
