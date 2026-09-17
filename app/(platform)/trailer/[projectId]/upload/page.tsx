import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { TrailerDetailsReview } from '@/components/trailer/TrailerDetailsReview'

export default async function TrailerUploadStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <TrailerDetailsReview
      key={project.updatedAt.toISOString()}
      projectId={project.id}
      coverUrl={project.frontCoverUrl}
      initial={{
        title: project.title ?? '',
        author: project.author ?? '',
        blurb: project.blurb ?? '',
      }}
    />
  )
}
