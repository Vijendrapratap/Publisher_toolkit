import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { AudiobookPlayerGallery } from '@/components/audiobook/AudiobookPlayerGallery'

export default async function AudiobookResultsStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <AudiobookPlayerGallery
      projectId={project.id}
      title={project.title || 'Untitled Book'}
      author={project.author || 'Unknown Author'}
      coverUrl={project.coverUrl}
      ttsProvider={project.ttsProvider}
      voiceModel={project.voiceModel}
      totalDuration={project.totalDuration}
      fullAudioUrl={project.fullAudioUrl}
      chapters={project.chapters.map((c) => ({
        id: c.id,
        chapterNumber: c.chapterNumber,
        title: c.title,
        audioUrl: c.audioUrl,
        duration: c.duration,
      }))}
    />
  )
}
