import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { LandingResultsView } from '@/components/landing/LandingResultsView'

export default async function LandingResultsStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <LandingResultsView
      projectId={project.id}
      title={project.title || 'Untitled Book'}
      publishedSlug={project.publishedSlug || project.id}
      template={project.template}
    />
  )
}
