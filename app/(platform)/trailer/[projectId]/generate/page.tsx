import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { TrailerGenerateRunner } from '@/components/trailer/TrailerGenerateRunner'

export default async function TrailerGenerateStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()
  if (project.status === 'uploaded') redirect(`/trailer/${project.id}/configure`)
  if (project.status === 'generated' && project.trailers.length > 0) {
    redirect(`/trailer/${project.id}/results`)
  }

  const formatCount = project.aspectRatios.length > 0 ? project.aspectRatios.length : 3

  return (
    <TrailerGenerateRunner
      projectId={project.id}
      formatCount={formatCount}
      durationLabel={project.length}
    />
  )
}
