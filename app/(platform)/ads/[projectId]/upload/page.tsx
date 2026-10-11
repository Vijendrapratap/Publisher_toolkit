import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { DetailsReview } from '@/components/ads/DetailsReview'

export default async function UploadStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()

  return (
    <DetailsReview
      key={book.updatedAt.toISOString()}
      projectId={book.id}
      coverUrl={book.frontCoverUrl}
      initial={{ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }}
      // A book being added (a root) goes to its project page; a creation goes on to configure.
      nextHref={book.parentBookId ? `/ads/${book.id}/configure` : `/ads/books/${book.id}`}
    />
  )
}
