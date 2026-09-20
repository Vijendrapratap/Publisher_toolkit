import { notFound, redirect } from 'next/navigation'
import { Clapperboard } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { GenerateRunner } from '@/components/platform/GenerateRunner'

const STAGES = [
  'Analyzing manuscript & story blurb',
  'Composing cinematic scene cards',
  'Synthesizing mood soundtrack',
  'Rendering & encoding MP4 cuts',
]

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

  const formatCount = project.aspectRatios.length || 3

  return (
    <GenerateRunner
      endpoint={`/api/trailer/projects/${project.id}/generate`}
      successHref={`/trailer/${project.id}/results`}
      cancelHref={`/trailer/${project.id}/configure`}
      title="Creating your book trailer"
      subtitle={`Rendering ${formatCount} video cut${formatCount === 1 ? '' : 's'} (${project.length}) with synced soundtrack and poster frames.`}
      stages={STAGES}
      stageMs={2400}
      icon={<Clapperboard className="size-7 animate-pulse" aria-hidden />}
      successMessage="Your trailers are ready"
    />
  )
}
