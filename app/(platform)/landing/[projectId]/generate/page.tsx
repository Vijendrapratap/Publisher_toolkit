import { notFound, redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { GenerateRunner } from '@/components/platform/GenerateRunner'

const STAGES = [
  'Compiling responsive layout',
  'Writing social meta tags',
  'Building the static bundle',
  'Reserving the public link',
]

export default async function LandingGenerateStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()
  if (project.status === 'generated' && project.publishedSlug) {
    redirect(`/landing/${project.id}/results`)
  }

  return (
    <GenerateRunner
      endpoint={`/api/landing/projects/${project.id}/generate`}
      successHref={`/landing/${project.id}/results`}
      cancelHref={`/landing/${project.id}/configure`}
      title="Publishing your book website"
      subtitle={`Building the public page for "${project.title || 'Untitled Book'}".`}
      stages={STAGES}
      stageMs={700}
      icon={<Globe className="size-7 animate-pulse" aria-hidden />}
      successMessage="Your site is live"
    />
  )
}
