import Link from 'next/link'
import {
  Baby,
  BookOpen,
  Feather,
  Layers,
  Palette,
  Plus,
  Puzzle,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectsForPublisher } from '@/lib/services/creator/queries'
import { Card } from '@/components/ui/card'
import { buttonClasses } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'
import { BOOK_TYPES } from '@/lib/services/creator/options'

export const dynamic = 'force-dynamic'

const ICON_MAP: Record<string, any> = {
  baby: Baby,
  palette: Palette,
  puzzle: Puzzle,
  'book-open': BookOpen,
  feather: Feather,
}

export default async function BookCreatorDashboard() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getCreatorProjectsForPublisher(publisherId)

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            AI Book Generation Studio
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Create Your Book
          </h1>
          <p className="mt-2 text-base text-ink-muted max-w-2xl">
            Generate illustrated children storybooks, coloring book spreads, story books, or word search and puzzle games.
          </p>
        </div>

        <Link
          href="/create-book/new"
          className={buttonClasses({ size: 'lg', variant: 'primary' })}
        >
          <Plus className="size-4" aria-hidden /> Create New Book
        </Link>
      </div>

      {/* Category Cards Showcase */}
      <section aria-label="Book Categories" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BOOK_TYPES.map((bt) => {
          const Icon = ICON_MAP[bt.icon] || BookOpen
          return (
            <Link
              key={bt.key}
              href={`/create-book/new?type=${bt.key}`}
              className="group flex flex-col justify-between rounded-2xl border border-line/70 bg-surface p-5 shadow-card transition-all hover:-translate-y-1 hover:border-accent/50 hover:shadow-lift"
            >
              <div>
                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent shadow-subtle group-hover:bg-accent group-hover:text-on-accent transition-colors">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold text-sm text-ink">{bt.title}</h3>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed line-clamp-2">
                  {bt.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3">
                <span className="text-[11px] font-bold text-accent">{bt.badge}</span>
                <span className="text-xs text-ink-muted group-hover:text-ink transition-colors">Start →</span>
              </div>
            </Link>
          )
        })}
      </section>

      {/* Projects List */}
      <section aria-labelledby="created-books-heading" className="mt-14">
        <div className="flex items-center justify-between">
          <h2 id="created-books-heading" className="font-display text-2xl font-bold tracking-tight">
            Your Generated Books
          </h2>
          <span className="text-xs text-ink-muted font-medium">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-10 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-muted">
              <BookOpen className="size-6" />
            </div>
            <h3 className="mt-4 font-semibold text-base">No books generated yet</h3>
            <p className="mt-1 text-sm text-ink-muted max-w-sm">
              Start by choosing whether you want to create a children's book, coloring book, story book, or puzzle games.
            </p>
            <Link
              href="/create-book/new"
              className={buttonClasses({ size: 'md', variant: 'primary', className: 'mt-5' })}
            >
              <Wand2 className="size-4" /> Start Your First Book
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              return (
                <Link
                  key={p.id}
                  href={`/create-book/${p.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-subtle transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-card"
                >
                  <div className="flex gap-4">
                    <div className="grid aspect-[3/4] w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2">
                      {p.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverImageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <BookOpen className="size-5 text-ink-muted/40" aria-hidden />
                      )}
                    </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        {p.bookType.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-ink-muted">{timeAgo(new Date(p.updatedAt))}</span>
                    </div>

                    <h3 className="mt-3 font-semibold text-base text-ink line-clamp-1 group-hover:text-accent transition-colors">
                      {p.title || 'Untitled Book'}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-muted">By {p.author || 'Author'}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-ink-muted/90 leading-relaxed">
                      {p.promptConcept}
                    </p>
                  </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3 text-xs text-ink-muted">
                    <span>
                      {p.pageCount} {p.bookType === 'novel_chapter' ? 'chapters' : 'pages'}
                    </span>
                    {p.wordCount > 0 && (
                      <span className="font-mono">{p.wordCount.toLocaleString()} words</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
