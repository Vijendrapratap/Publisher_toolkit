import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { BookProjectStudio } from '@/components/creator/BookProjectStudio'

export const dynamic = 'force-dynamic'

export default async function BookProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, projectId)

  if (!project) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-12">
      <BookProjectStudio initialProject={project} />
    </div>
  )
}
