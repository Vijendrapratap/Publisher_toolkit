'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Baby,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Feather,
  Layers,
  Loader2,
  Palette,
  Puzzle,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import {
  BOOK_TYPES,
  STYLES_BY_TYPE,
  TARGET_AUDIENCES,
  INSPIRATION_TEMPLATES,
  type BookTypeKey,
} from '@/lib/services/creator/options'

const ICONS_MAP: Record<string, any> = {
  baby: Baby,
  palette: Palette,
  puzzle: Puzzle,
  'book-open': BookOpen,
  feather: Feather,
}

export function NewBookForm() {
  const router = useRouter()

  const [bookType, setBookType] = useState<BookTypeKey>('children')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [author, setAuthor] = useState('')
  const [promptConcept, setPromptConcept] = useState('')
  const [styleTheme, setStyleTheme] = useState(STYLES_BY_TYPE['children'][0].key)
  const [targetAudience, setTargetAudience] = useState<string>('early_readers')
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [pageCount, setPageCount] = useState(8)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(type: BookTypeKey) {
    setBookType(type)
    const availableStyles = STYLES_BY_TYPE[type]
    if (availableStyles.length > 0) {
      setStyleTheme(availableStyles[0].key)
    }
    const def = BOOK_TYPES.find((b) => b.key === type)
    if (def) {
      setPageCount(def.defaultPages)
    }
    setError(null)
  }

  function handleLoadTemplate(tmpl: (typeof INSPIRATION_TEMPLATES)[number]) {
    setBookType(tmpl.bookType)
    setTitle(tmpl.title)
    setPromptConcept(tmpl.concept)
    setStyleTheme(tmpl.styleTheme)
    setTargetAudience(tmpl.targetAudience)
    const def = BOOK_TYPES.find((b) => b.key === tmpl.bookType)
    if (def) setPageCount(def.defaultPages)
    toast.success('Inspiration template applied!', {
      description: `Loaded "${tmpl.title}"`,
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a title for your book.')
      return
    }
    if (!promptConcept.trim() || promptConcept.trim().length < 10) {
      setError('Please write at least a brief concept or premise for your book.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const res = await fetch('/api/creator/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          author: author.trim() || undefined,
          bookType,
          styleTheme,
          targetAudience,
          difficultyLevel: bookType === 'word_game' ? difficultyLevel : undefined,
          promptConcept: promptConcept.trim(),
          pageCount: Number(pageCount) || 8,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create and generate book')
      }

      toast.success('Book created!', {
        description: `"${title}" has been successfully generated.`,
      })
      router.push(`/create-book/${json.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong during generation.')
      toast.error('Generation failed', { description: err.message })
    } finally {
      setPending(false)
    }
  }

  const currentStyles = STYLES_BY_TYPE[bookType] || []

  return (
    <Card className="p-6 sm:p-8">
      {/* Quick Inspiration Bar */}
      <div className="mb-8 rounded-2xl border border-accent/25 bg-accent-soft/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Wand2 className="size-4" aria-hidden /> Quick Inspiration & Pre-Filled Presets
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Click any genre template to pre-fill prompt concepts, styles, and chapter settings:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INSPIRATION_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.title}
              type="button"
              onClick={() => handleLoadTemplate(tmpl)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-subtle transition hover:border-accent hover:text-accent hover:scale-[1.02]"
            >
              <Sparkles className="size-3 text-accent" />
              {tmpl.title}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
        {/* STEP 1: BOOK TYPE */}
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-accent" aria-hidden />
            <h2 className="font-display text-lg font-semibold">1. Choose What Kind of Book to Create</h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Select from illustrated children books, coloring books, word search games, or chapter-by-chapter novels.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BOOK_TYPES.map((bt) => {
              const isSelected = bookType === bt.key
              const Icon = ICONS_MAP[bt.icon] || BookOpen
              return (
                <button
                  key={bt.key}
                  type="button"
                  onClick={() => handleTypeChange(bt.key)}
                  className={cn(
                    'flex flex-col items-start rounded-2xl border p-4 text-left transition-all',
                    isSelected
                      ? 'border-accent bg-accent-soft/70 shadow-inset ring-2 ring-accent/30'
                      : 'border-line/70 bg-surface shadow-subtle hover:border-accent/40 hover:bg-surface-2'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={cn('grid size-9 place-items-center rounded-xl', isSelected ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-muted')}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', isSelected ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-muted')}>
                      {bt.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-ink">{bt.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted leading-relaxed">{bt.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {bt.tags.slice(0, 2).map((t) => (
                      <span key={t} className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* STEP 2: STYLE & AESTHETIC */}
        <div>
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-accent" aria-hidden />
            <h2 className="font-display text-lg font-semibold">2. Choose Visual & Narrative Style</h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Tailor the art style prompts, line weights, or authorial voice for your selected format.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentStyles.map((style) => {
              const isSelected = styleTheme === style.key
              return (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setStyleTheme(style.key)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all',
                    isSelected
                      ? 'border-accent bg-accent-soft/80 shadow-inset ring-2 ring-accent/30'
                      : 'border-line/70 bg-surface shadow-subtle hover:border-accent/40'
                  )}
                >
                  <span className="text-xs font-bold text-ink">{style.label}</span>
                  <span className="mt-1 line-clamp-2 text-[11px] text-ink-muted leading-relaxed">{style.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* STEP 3: BOOK DETAILS & CONCEPT */}
        <div className="grid gap-5 rounded-2xl border border-line/60 bg-surface-2/60 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Book Details & Premise</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bookTitle" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Book Title <span className="text-danger">*</span>
              </label>
              <input
                id="bookTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Secret of the Lighthouse Bay"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="bookSubtitle" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Subtitle / Series Tag (optional)
              </label>
              <input
                id="bookSubtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. A Bedtime Adventure Story"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="authorName" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Author Name
              </label>
              <input
                id="authorName"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label htmlFor="targetAudience" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Target Audience
              </label>
              <select
                id="targetAudience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {TARGET_AUDIENCES.map((aud) => (
                  <option key={aud.key} value={aud.key}>
                    {aud.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="promptConcept" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Book Concept / Story Premise / Puzzle Theme <span className="text-danger">*</span>
            </label>
            <textarea
              id="promptConcept"
              rows={4}
              value={promptConcept}
              onChange={(e) => setPromptConcept(e.target.value)}
              placeholder="Describe your story idea, characters, setting, lesson, or puzzle vocabulary theme..."
              className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pageCount" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {bookType === 'novel_chapter' ? 'Target Chapters in Outline' : 'Target Spreads / Pages'}
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  id="pageCount"
                  type="range"
                  min={bookType === 'short_story' ? 1 : 4}
                  max={bookType === 'novel_chapter' ? 20 : 15}
                  value={pageCount}
                  onChange={(e) => setPageCount(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="w-12 text-right font-mono text-sm font-semibold text-ink">
                  {pageCount} {bookType === 'novel_chapter' ? 'chs' : 'pgs'}
                </span>
              </div>
            </div>

            {bookType === 'word_game' && (
              <div>
                <label htmlFor="difficulty" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Puzzle Difficulty
                </label>
                <select
                  id="difficulty"
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value as any)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="easy">Easy (Beginner / Kids)</option>
                  <option value="medium">Medium (Standard Solver)</option>
                  <option value="hard">Hard (Master Puzzler)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <CheckCircle2 className="size-4 text-accent" aria-hidden /> Generates full structured spreads, artwork prompts, or outline.
          </p>
          <Button type="submit" size="lg" loading={pending} disabled={pending || !title.trim() || !promptConcept.trim()}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generating Book Content…
              </>
            ) : (
              <>
                <Wand2 className="size-4" aria-hidden />
                Generate Book Project
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
