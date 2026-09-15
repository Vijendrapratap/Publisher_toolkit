import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { GenerateButton } from './GenerateButton'

// Per-publisher data — must never be statically prerendered/shared across users.
export const dynamic = 'force-dynamic'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) notFound()

  const creativeSet = await getLatestCreativeSetForBook(book.id, publisherId)

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{book.title ?? 'Untitled book'}</h1>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.frontCoverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.frontCoverUrl} alt="Front cover" className="w-48 mt-4" />
      )}

      <div className="mt-6">
        <GenerateButton bookId={book.id} />
      </div>

      {creativeSet && (
        <section className="mt-8 grid grid-cols-2 gap-6">
          {creativeSet.images.map((image) => (
            <div key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl} alt={image.sizeKey} className="border rounded" />
              <a href={image.imageUrl} download className="text-sm underline">
                Download {image.sizeKey}
              </a>
            </div>
          ))}
          {creativeSet.adCopies.map((copy) => (
            <div key={copy.id} className="text-sm">
              <strong>{copy.platform}</strong>: {copy.headline} — {copy.primaryText}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
