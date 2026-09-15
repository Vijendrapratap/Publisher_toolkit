'use client'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { PLATFORMS, TEMPLATES, TONES, type CopyTone, type TemplateKey } from '@/lib/services/ads/options'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { sampleAdCopy } from '@/lib/services/ads/sampleCopy'
import { nextRadioIndex } from '@/lib/ui/radioKeys'

const sizesFor = (platform: AdPlatform) =>
  CREATIVE_SIZES.filter((s) => s.platform === platform).map((s) => `${s.width}×${s.height}`)

// Roving-tabindex arrow key contract for a role="radio" group: moves selection
// and focus together, and leaves other keys (Tab, Enter, Space) untouched.
function handleRadioKeyDown<K extends string>(
  e: KeyboardEvent<HTMLButtonElement>,
  keys: readonly K[],
  index: number,
  select: (key: K) => void
) {
  const next = nextRadioIndex(e.key, index, keys.length)
  if (next === null) return
  e.preventDefault()
  select(keys[next])
  const group = e.currentTarget.closest('[role="radiogroup"]')
  const target = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]
  target?.focus()
}

export function ConfigureForm({
  projectId,
  initial,
  book,
  error: generationError,
}: {
  projectId: string
  initial: { platforms: AdPlatform[]; copyTone: CopyTone; templateKey: TemplateKey }
  book: { title: string; author: string; blurb: string; coverUrl: string | null }
  error?: string
}) {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<AdPlatform[]>(initial.platforms)
  const [copyTone, setCopyTone] = useState<CopyTone>(initial.copyTone)
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initial.templateKey)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePlatform = (key: AdPlatform) =>
    setPlatforms((current) => (current.includes(key) ? current.filter((p) => p !== key) : [...current, key]))

  const previewHeadline = sampleAdCopy(book, copyTone)[0].headline

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (platforms.length === 0) {
      setError('Choose at least one platform.')
      return
    }
    setPending(true)
    setError(null)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: PLATFORMS.map((p) => p.key).filter((k) => platforms.includes(k)), copyTone, templateKey }),
    })
    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'We couldn’t save your settings.'
      setError(message)
      toast.error(message)
      return
    }
    router.push(`/ads/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {generationError && (
        <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/10 p-4 sm:flex-row sm:items-center">
          <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Generation didn’t finish.</span> {generationError}
          </p>
          <Button type="submit" variant="danger" size="sm" className="sm:ml-auto" loading={pending}>
            Try again
          </Button>
        </div>
      )}

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Where will these ads run?</legend>
          <p className="text-sm text-ink-muted">We’ll make every size each platform needs.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => togglePlatform(p.key)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all',
                    selected ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-line bg-surface hover:border-accent/40'
                  )}
                >
                  <span
                    className={cn(
                      'absolute right-3 top-3 grid size-5 place-items-center rounded-full border',
                      selected ? 'border-accent bg-accent text-on-accent' : 'border-line'
                    )}
                  >
                    {selected && <Check className="size-3" aria-hidden />}
                  </span>
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs text-ink-muted">{p.description}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {sizesFor(p.key).map((s) => (
                      <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{s}</span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Copy tone</legend>
          <div role="radiogroup" aria-label="Copy tone" className="mt-4 grid gap-3 sm:grid-cols-3">
            {TONES.map((t, i) => {
              const selected = copyTone === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setCopyTone(t.key)}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      TONES.map((tone) => tone.key),
                      i,
                      setCopyTone
                    )
                  }
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all',
                    selected ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-line bg-surface hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-xs text-ink-muted">{t.description}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
            <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
            <span className="text-ink-muted">Sample headline:</span>
            <span className="font-medium">{previewHeadline}</span>
          </p>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Design template</legend>
          <div role="radiogroup" aria-label="Design template" className="mt-4 grid gap-4 sm:grid-cols-3">
            {TEMPLATES.map((t, i) => {
              const selected = templateKey === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTemplateKey(t.key)}
                  onKeyDown={(e) =>
                    handleRadioKeyDown(
                      e,
                      TEMPLATES.map((tpl) => tpl.key),
                      i,
                      setTemplateKey
                    )
                  }
                  className={cn(
                    'flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
                    selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent/40'
                  )}
                >
                  <span
                    className="flex aspect-square flex-col items-center justify-center gap-2 p-4"
                    style={{ background: t.palette.background, color: t.palette.ink }}
                    aria-hidden
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={book.coverUrl} alt="" className="h-1/2 rounded-md object-cover shadow-lg" />
                    ) : (
                      <span className="h-1/2 w-1/3 rounded-md bg-current opacity-20" />
                    )}
                    <span className="line-clamp-1 font-display text-sm font-semibold">{book.title || 'Your book'}</span>
                    <span className="h-0.5 w-8" style={{ background: t.palette.accent }} />
                  </span>
                  <span className="flex flex-col gap-0.5 bg-surface p-3">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-xs text-ink-muted">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-ink-muted">
          {platforms.length === 0
            ? 'No platforms selected'
            : `${CREATIVE_SIZES.filter((s) => platforms.includes(s.platform)).length} ad sizes`}
        </span>
        <Button type="submit" size="lg" loading={pending} disabled={platforms.length === 0}>
          <Sparkles className="size-4" aria-hidden /> Generate creatives
        </Button>
      </div>
    </form>
  )
}
