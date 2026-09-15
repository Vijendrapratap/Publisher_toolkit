'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewBookPage() {
  const router = useRouter()
  const [bookId, setBookId] = useState<string | null>(null)
  const [needsManualCover, setNeedsManualCover] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const res = await fetch('/api/books', { method: 'POST', body: formData })
    setPending(false)
    if (!res.ok) {
      setError('Something went wrong uploading your book. Please try again.')
      return
    }
    const json = await res.json()
    if (json.needsManualCover) {
      setBookId(json.id)
      setNeedsManualCover(true)
      return
    }
    router.push(`/dashboard/books/${json.id}`)
  }

  async function handleCoverSubmit(formData: FormData) {
    if (!bookId) return
    setPending(true)
    setError(null)
    const res = await fetch(`/api/books/${bookId}`, { method: 'PATCH', body: formData })
    setPending(false)
    if (!res.ok) {
      setError('Something went wrong uploading the cover. Please try again.')
      return
    }
    router.push(`/dashboard/books/${bookId}`)
  }

  return (
    <div className="p-8 max-w-md flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Upload a book</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!needsManualCover && (
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="file" name="pdf" accept="application/pdf" required />
          <button type="submit" disabled={pending} className="bg-black text-white rounded px-4 py-2">
            {pending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      {needsManualCover && (
        <form action={handleCoverSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-amber-700">
            We couldn&apos;t find a cover in that PDF — please upload one.
          </p>
          <input type="file" name="frontCover" accept="image/*" />
          <input type="file" name="backCover" accept="image/*" />
          <button type="submit" disabled={pending} className="bg-black text-white rounded px-4 py-2">
            {pending ? 'Uploading…' : 'Save cover'}
          </button>
        </form>
      )}
    </div>
  )
}
