import Link from 'next/link'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { NewBookForm } from '@/components/creator/NewBookForm'

export const metadata = {
  title: 'Create Your Book | Publisher Toolkit',
  description: 'Generate children books, coloring books, story books, and puzzle games with AI images.',
}

export default function NewBookPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/create-book"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Book Creator Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          New Book Project
        </span>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Create Your Book
        </h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">
          Configure your book type (children picture book, coloring book, story book, or games), visual style, target reader audience, and prompt concept to generate complete spreads and artwork.
        </p>
      </div>

      <NewBookForm />
    </div>
  )
}
