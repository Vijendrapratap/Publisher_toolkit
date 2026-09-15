import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { GenerateRunner } from '@/components/ads/GenerateRunner'

export default async function GenerateStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  if (book.status === 'uploaded') redirect(`/ads/${book.id}/configure`)
  if (!book.frontCoverUrl) redirect(`/ads/${book.id}/upload`)

  const sizeCount = CREATIVE_SIZES.filter((s) => book.platforms.includes(s.platform)).length
  return <GenerateRunner projectId={book.id} platformCount={book.platforms.length} sizeCount={sizeCount} />
}
