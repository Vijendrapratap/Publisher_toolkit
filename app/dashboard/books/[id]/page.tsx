import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) notFound()

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{book.title ?? 'Untitled book'}</h1>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.frontCoverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.frontCoverUrl} alt="Front cover" className="w-48 mt-4" />
      )}
    </main>
  )
}
