import { notFound, redirect } from 'next/navigation'
import { Headphones } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { GenerateRunner } from '@/components/platform/GenerateRunner'

const STAGES = [
  'Preparing chapter text',
  'Synthesizing neural narration',
  'Mastering chapter audio',
  'Assembling the full audiobook',
]

export default async function AudiobookGenerateStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()
  if (project.status === 'generated' && project.fullAudioUrl) {
    redirect(`/audiobook/${project.id}/results`)
  }

  const chapterCount = project.chapters.length

  return (
    <GenerateRunner
      endpoint={`/api/audiobook/projects/${project.id}/generate`}
      successHref={`/audiobook/${project.id}/results`}
      cancelHref={`/audiobook/${project.id}/configure`}
      title="Narrating your audiobook"
      subtitle={`Generating voice audio for ${chapterCount} chapter${chapterCount === 1 ? '' : 's'} in "${project.title || 'Untitled Book'}".`}
      stages={STAGES}
      stageMs={3000}
      icon={<Headphones className="size-7 animate-pulse" aria-hidden />}
      successMessage="Your audiobook is ready"
    />
  )
}
