import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectsForPublisher } from '@/lib/services/trailer/queries'
import { ProjectRail } from '@/components/platform/ProjectRail'

export const metadata: Metadata = { title: { default: 'Trailer Video', template: '%s · Trailer Video' } }
export const dynamic = 'force-dynamic'

export default async function TrailerLayout({ children }: { children: React.ReactNode }) {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getTrailerProjectsForPublisher(publisherId)

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_1fr] lg:gap-10 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ProjectRail projects={projects} newHref="/trailer/new" basePath="/trailer" />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
