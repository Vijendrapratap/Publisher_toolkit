'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { COPY_LIMITS } from '@/lib/services/ads/options'

type Copy = { id: string; platform: AdPlatform; headline: string; primaryText: string; description: string }
type Key = 'headline' | 'primaryText' | 'description'

const LABELS: Record<Key, string> = { headline: 'Headline', primaryText: 'Primary text', description: 'Description' }

function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span className={cn('text-xs tabular-nums', length > limit ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-ink-muted')}>
      {length}/{limit}
    </span>
  )
}

export function CopyEditor({ copy }: { copy: Copy }) {
  const [saved, setSaved] = useState(copy)
  const [draft, setDraft] = useState(copy)
  const [pending, setPending] = useState(false)
  const limits = COPY_LIMITS[copy.platform]
  const dirty = (['headline', 'primaryText', 'description'] as Key[]).some((k) => draft[k] !== saved[k])
  const blank = !saved.headline && !saved.primaryText && !saved.description

  async function save() {
    setPending(true)
    const res = await fetch(`/api/ads/copies/${copy.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headline: draft.headline, primaryText: draft.primaryText, description: draft.description }),
    })
    setPending(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your copy.')
      return
    }
    const next = { ...copy, ...(await res.json()) }
    setSaved(next)
    setDraft(next)
    toast.success('Copy saved')
  }

  const field = (key: Key) => {
    const id = `${copy.id}-${key}`
    const props = { id, value: draft[key], onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value })) }
    return (
      <Field label={LABELS[key]} htmlFor={id}>
        {key === 'primaryText' ? <Textarea rows={3} maxLength={500} {...props} /> : <Input maxLength={key === 'headline' ? 150 : 300} {...props} />}
        <span className="self-end">
          <Counter length={draft[key].length} limit={limits[key]} />
        </span>
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {blank && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <PenLine className="size-4 shrink-0" aria-hidden />
          We couldn’t write copy for this platform. Add your own below.
        </p>
      )}
      {field('headline')}
      {field('primaryText')}
      {field('description')}
      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(saved)}>
            Discard
          </Button>
        )}
        <Button type="button" size="sm" onClick={save} loading={pending} disabled={!dirty}>
          Save copy
        </Button>
      </div>
    </div>
  )
}
