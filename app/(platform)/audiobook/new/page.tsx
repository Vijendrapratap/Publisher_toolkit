import type { Metadata } from 'next'
import { Headphones } from 'lucide-react'
import { NewAudiobookProjectForm } from '@/components/audiobook/NewAudiobookProjectForm'

export const metadata: Metadata = { title: 'New Audiobook Project' }

export default function NewAudiobookPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl bg-tint-audiobook text-accent">
            <Headphones className="size-4" />
          </span>
          Create New Audiobook
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload your book manuscript in PDF or paste chapter text to begin. We automatically detect chapters and extract book metadata.
        </p>
      </div>

      <NewAudiobookProjectForm />
    </div>
  )
}
