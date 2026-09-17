import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { resumeStep, stepHref } from '@/lib/services/trailer/steps'

export default async function TrailerProjectIndex({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  redirect(stepHref(project.id, resumeStep(project.status, project.trailers.length > 0)))
}
