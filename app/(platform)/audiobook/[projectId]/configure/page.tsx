import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { AudiobookConfigureForm } from '@/components/audiobook/AudiobookConfigureForm'
import type { AudioFormatKey, TtsEngineKey } from '@/lib/services/audiobook/options'

export default async function AudiobookConfigureStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <AudiobookConfigureForm
      projectId={project.id}
      initial={{
        ttsProvider: (project.ttsProvider as TtsEngineKey) || 'fishaudio',
        voiceModel: project.voiceModel || 'warm-literary',
        voicePacing: project.voicePacing || 1.0,
        audioFormat: (project.audioFormat as AudioFormatKey) || 'mp3',
        chapters: project.chapters.map((c) => ({
          id: c.id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          content: c.content,
        })),
      }}
      book={{
        title: project.title ?? '',
        author: project.author ?? '',
        blurb: project.blurb ?? '',
        coverUrl: project.coverUrl,
      }}
    />
  )
}
