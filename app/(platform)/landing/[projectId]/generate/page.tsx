import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { LandingGenerateRunner } from '@/components/landing/LandingGenerateRunner'

export default async function LandingGenerateStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <LandingGenerateRunner
      projectId={project.id}
      title={project.title || 'Untitled Book'}
    />
  )
}
