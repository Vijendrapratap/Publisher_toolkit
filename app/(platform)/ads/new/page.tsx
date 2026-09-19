import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherBookLibrary } from '@/lib/services/ads/queries'
import { NewProjectForm } from '@/components/ads/NewProjectForm'

export const metadata: Metadata = { title: 'New campaign' }

export default async function NewAdsProjectPage() {
  const publisherId = await requireCurrentPublisherId()
  const library = await getPublisherBookLibrary(publisherId)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Step 1 of 4</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Create an ad campaign</h1>
        <p className="mt-2 text-ink-muted">
          Pick a book from your library or drop in a new PDF to generate high-converting ad creatives.
        </p>
      </header>
      <NewProjectForm
        initialBooks={library.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          blurb: b.blurb,
          frontCoverUrl: b.frontCoverUrl,
          campaignCount: b.campaignCount,
          createdAt: b.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
