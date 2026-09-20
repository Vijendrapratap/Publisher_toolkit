import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getRecentBooksForPublisher } from '@/lib/services/ads/queries'
import { ProjectRail } from '@/components/platform/ProjectRail'

export const metadata: Metadata = { title: { default: 'Ads Creative', template: '%s · Ads Creative' } }
export const dynamic = 'force-dynamic'

// The rail is a jump list, not a browser — the full set lives on /ads.
const RAIL_LIMIT = 30

export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getRecentBooksForPublisher(publisherId, RAIL_LIMIT)

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_1fr] lg:gap-10 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ProjectRail projects={projects} newHref="/ads/new" basePath="/ads" />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
