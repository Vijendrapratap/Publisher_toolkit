import { redirect, notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { resumeStep, stepHref } from '@/lib/services/landing/steps'

export default async function LandingProjectRoot({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  const hasPublished = Boolean(project.publishedSlug)
  redirect(stepHref(project.id, resumeStep(project.status, hasPublished)))
}
