import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AddBookForm } from '@/components/ads/AddBookForm'

export const metadata: Metadata = { title: 'Add a book' }

export default function AddBookPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link href="/ads" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Your books
      </Link>
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add a book</h1>
        <p className="mt-2 text-ink-muted">We’ll use its cover and details to make your A+ images, video and ad images.</p>
      </header>
      <AddBookForm />
    </div>
  )
}
