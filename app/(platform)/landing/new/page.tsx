import type { Metadata } from 'next'
import { LayoutTemplate } from 'lucide-react'
import { NewLandingProjectForm } from '@/components/landing/NewLandingProjectForm'

export const metadata: Metadata = { title: 'New Landing Page' }

export default function NewLandingProjectPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl bg-tint-landing text-accent">
            <LayoutTemplate className="size-4" />
          </span>
          Create New Book Landing Page
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload your book PDF or enter book details to generate an instant high-converting landing page.
        </p>
      </div>

      <NewLandingProjectForm />
    </div>
  )
}
