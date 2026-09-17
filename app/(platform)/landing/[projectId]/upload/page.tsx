import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { stepHref } from '@/lib/services/landing/steps'

export default async function LandingUploadStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  redirect(stepHref(project.id, 'configure'))
}
