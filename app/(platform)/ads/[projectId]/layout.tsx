import { notFound } from 'next/navigation'
import { BookImage } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { buildStepItems, statusDisplay } from '@/lib/services/ads/steps'
import { getCampaignObjective } from '@/lib/services/ads/options'
import { Stepper } from '@/components/platform/Stepper'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  const status = statusDisplay(book.status)
  const objective = getCampaignObjective(book.campaignObjective)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
            {book.frontCoverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.frontCoverUrl} alt={`Cover of ${book.title ?? 'this book'}`} className="size-full object-cover" />
            ) : (
              <BookImage className="size-6 text-ink-muted" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{book.title || 'Untitled book'}</h1>
              {book.campaignName && (
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  {book.campaignName}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              <span>{book.author || 'Unknown author'}</span>
              <span>•</span>
              <span className="font-medium text-ink">{objective.badge}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={status.tone} className="hidden sm:inline-flex">{status.label}</Badge>
            <Link
              href="/ads/new"
              className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'hidden md:inline-flex' })}
            >
              <Plus className="size-3.5" aria-hidden /> Another campaign
            </Link>
          </div>
        </div>
        <Stepper steps={buildStepItems(book.id, book.status, Boolean(set))} />
      </header>
      {children}
    </div>
  )
}
