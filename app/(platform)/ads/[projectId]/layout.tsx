import { notFound } from 'next/navigation'
import { BookImage } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { buildStepItems, statusDisplay } from '@/lib/services/ads/steps'
import { Stepper } from '@/components/platform/Stepper'
import { Badge } from '@/components/ui/badge'

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
            {book.frontCoverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.frontCoverUrl} alt={`Cover of ${book.title ?? 'this book'}`} className="size-full object-cover" />
            ) : (
              <BookImage className="size-6 text-ink-muted" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{book.title || 'Untitled book'}</h1>
            <p className="truncate text-sm text-ink-muted">{book.author || 'Unknown author'}</p>
          </div>
          <Badge tone={status.tone} className="ml-auto hidden sm:inline-flex">{status.label}</Badge>
        </div>
        <Stepper steps={buildStepItems(book.id, book.status, Boolean(set))} />
      </header>
      {children}
    </div>
  )
}
