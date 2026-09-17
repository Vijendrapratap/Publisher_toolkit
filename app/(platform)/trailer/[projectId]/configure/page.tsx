import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { TrailerConfigureForm } from '@/components/trailer/TrailerConfigureForm'
import type {
  TrailerAspectRatio,
  TrailerLength,
  TrailerMusicMood,
  TrailerStyle,
} from '@/lib/services/trailer/options'

export default async function TrailerConfigureStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { projectId } = await params
  const { error } = await searchParams
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <TrailerConfigureForm
      projectId={project.id}
      error={error}
      initial={{
        aspectRatios: (project.aspectRatios ?? ['9:16', '1:1', '16:9']) as TrailerAspectRatio[],
        length: (project.length ?? '30s') as TrailerLength,
        style: (project.style ?? 'cinematic') as TrailerStyle,
        musicMood: (project.musicMood ?? 'suspenseful') as TrailerMusicMood,
      }}
      book={{
        title: project.title ?? '',
        author: project.author ?? '',
        blurb: project.blurb ?? '',
        coverUrl: project.frontCoverUrl,
      }}
    />
  )
}
