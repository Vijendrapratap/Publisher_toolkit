import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { stepHref } from '@/lib/services/audiobook/steps'

export default async function AudiobookUploadStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  // If already uploaded, proceed to configure
  redirect(stepHref(project.id, 'configure'))
}
