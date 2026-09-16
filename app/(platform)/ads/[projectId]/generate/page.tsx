import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { GenerateRunner } from '@/components/ads/GenerateRunner'

export default async function GenerateStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  if (book.status === 'uploaded') redirect(`/ads/${book.id}/configure`)
  if (!book.frontCoverUrl) redirect(`/ads/${book.id}/upload`)
  // Revisiting this page (back button, pasted URL) would otherwise mount
  // GenerateRunner again and POST a second, redundant generation.
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (book.status === 'generated' && set) redirect(`/ads/${book.id}/results`)

  const sizeCount = CREATIVE_SIZES.filter((s) => book.platforms.includes(s.platform)).length
  return <GenerateRunner projectId={book.id} platformCount={book.platforms.length} sizeCount={sizeCount} />
}
