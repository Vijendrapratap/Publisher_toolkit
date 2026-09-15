'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewBookPage() {
  const router = useRouter()
  const [needsManualCover, setNeedsManualCover] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const res = await fetch('/api/books', { method: 'POST', body: formData })
    const json = await res.json()
    setPending(false)
    if (json.needsManualCover) {
      setNeedsManualCover(true)
      return
    }
    router.push(`/dashboard/books/${json.id}`)
  }

  return (
    <form action={handleSubmit} className="p-8 flex flex-col gap-4 max-w-md">
      <h1 className="text-xl font-semibold">Upload a book</h1>
      <input type="file" name="pdf" accept="application/pdf" required />
      {needsManualCover && (
        <>
          <p className="text-sm text-amber-700">
            We couldn&apos;t find a cover in that PDF — please upload one.
          </p>
          <input type="file" name="frontCover" accept="image/*" />
          <input type="file" name="backCover" accept="image/*" />
        </>
      )}
      <button type="submit" disabled={pending} className="bg-black text-white rounded px-4 py-2">
        {pending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}
