import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherTrailerBookLibrary } from '@/lib/services/trailer/queries'
import { NewTrailerProjectForm } from '@/components/trailer/NewTrailerProjectForm'

export const metadata: Metadata = { title: 'New trailer project' }

export default async function NewTrailerProjectPage() {
  const publisherId = await requireCurrentPublisherId()
  const library = await getPublisherTrailerBookLibrary(publisherId)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Step 1 of 4</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Create a book trailer</h1>
        <p className="mt-2 text-ink-muted">
          Pick a book from your library, start with quick setup, or drop in a book PDF to create cinematic video trailers.
        </p>
      </header>
      <NewTrailerProjectForm
        initialBooks={library.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          blurb: b.blurb,
          frontCoverUrl: b.frontCoverUrl,
          createdAt: b.createdAt.toISOString(),
          source: b.source,
        }))}
      />
    </div>
  )
}
