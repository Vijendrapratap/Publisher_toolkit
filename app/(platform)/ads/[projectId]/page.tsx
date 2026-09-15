import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { resumeStep, stepHref } from '@/lib/services/ads/steps'

export default async function ProjectIndex({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  redirect(stepHref(book.id, resumeStep(book.status, Boolean(set))))
}
