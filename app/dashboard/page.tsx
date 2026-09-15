import Link from 'next/link'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'

// Per-publisher data — must never be statically prerendered/shared across users.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const publisherId = await requireCurrentPublisherId()
  const books = await getBooksForPublisher(publisherId)

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Your books</h1>
        <Link href="/dashboard/books/new" className="bg-black text-white rounded px-4 py-2">
          Upload a book
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/dashboard/books/${book.id}`}>{book.title ?? 'Untitled book'}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
