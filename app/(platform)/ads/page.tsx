import Link from 'next/link'
import { BookImage, Megaphone, Plus } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProjects } from '@/lib/services/ads/projects'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdsHomePage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getAdsProjects(publisherId)
  const addButton = (
    <Link href="/ads/new" className={buttonClasses({ size: 'lg' })}>
      <Plus className="size-4" aria-hidden /> Add a book
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Ads Creative</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your books</h1>
          <p className="mt-2 text-ink-muted">Open a book to make A+ images, a video ad or ad images for it.</p>
        </div>
        {projects.length > 0 && addButton}
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-7" aria-hidden />}
          title="Add your first book"
          description="Paste a store link or upload a cover. Then make A+ images, a video ad or ad images for it."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/ads/books/${p.id}`}
                className="flex h-full gap-4 rounded-card bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="grid aspect-[3/4] w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 shadow-inset">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <BookImage className="size-5 text-ink-muted" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">{p.title}</span>
                  {p.author && <span className="truncate text-sm text-ink-muted">{p.author}</span>}
                  <span className="mt-auto text-xs text-ink-muted">{p.summary}</span>
                  <span className="text-xs text-ink-muted">{timeAgo(p.activityAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
