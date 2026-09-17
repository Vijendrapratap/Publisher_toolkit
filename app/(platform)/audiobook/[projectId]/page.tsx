import { redirect, notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { resumeStep, stepHref } from '@/lib/services/audiobook/steps'

export default async function AudiobookProjectRoot({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  const hasAudio = Boolean(project.fullAudioUrl || project.chapters.some((c) => c.duration > 0))
  redirect(stepHref(project.id, resumeStep(project.status, hasAudio)))
}
