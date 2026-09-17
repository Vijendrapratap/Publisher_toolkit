import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { AudiobookGenerateRunner } from '@/components/audiobook/AudiobookGenerateRunner'

export default async function AudiobookGenerateStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <AudiobookGenerateRunner
      projectId={project.id}
      title={project.title || 'Untitled Book'}
      chapterCount={project.chapters.length}
    />
  )
}
