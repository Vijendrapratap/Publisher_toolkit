import type { Metadata } from 'next'
import { NewProjectForm } from '@/components/ads/NewProjectForm'

export const metadata: Metadata = { title: 'New project' }

export default function NewAdsProjectPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Step 1 of 4</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Upload your book</h1>
        <p className="mt-2 text-ink-muted">We’ll pull the cover, title, author and blurb straight from your PDF.</p>
      </header>
      <NewProjectForm />
    </div>
  )
}
