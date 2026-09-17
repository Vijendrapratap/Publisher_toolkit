import Link from 'next/link'
import type { Metadata } from 'next'
import { Headphones, Plus, Sparkles, Clock, Music } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { listAudiobookProjectsForPublisher } from '@/lib/services/audiobook/queries'
import { statusDisplay, stepHref, resumeStep } from '@/lib/services/audiobook/steps'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Audio Book' }

export default async function AudiobookPage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await listAudiobookProjectsForPublisher(publisherId)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-tint-audiobook text-accent shadow-card">
              <Headphones className="size-5" />
            </span>
            Audio Book Creation
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Turn your book manuscript into chapter-by-chapter audiobooks narrated with natural Fish Audio & Qwen TTS neural voices.
          </p>
        </div>

        <Link href="/audiobook/new">
          <Button size="lg" className="w-full sm:w-auto shadow-card">
            <Plus className="size-4" /> Create Audiobook
          </Button>
        </Link>
      </div>

      {/* Projects List or Empty State */}
      {projects.length === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center border-dashed">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
            <Headphones className="size-7 opacity-40" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">No audiobooks created yet</h3>
          <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">
            Upload your manuscript or paste chapter text to begin synthesizing your first audiobook with AI voices.
          </p>
          <Link href="/audiobook/new" className="mt-5">
            <Button variant="primary">
              <Plus className="size-4" /> Create First Audiobook
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasAudio = Boolean(project.fullAudioUrl || project.chapters.some((c) => c.duration > 0))
            const targetStep = resumeStep(project.status, hasAudio)
            const status = statusDisplay(project.status)
            const totalMin = Math.floor(project.totalDuration / 60)
            const totalSec = project.totalDuration % 60

            return (
              <Link key={project.id} href={stepHref(project.id, targetStep)} className="group">
                <Card className="flex h-full flex-col justify-between p-5 transition-all hover:border-accent/60 hover:shadow-card">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent uppercase">
                        {project.ttsProvider}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>

                    <h3 className="mt-3 font-display text-base font-semibold group-hover:text-accent transition-colors line-clamp-1">
                      {project.title || 'Untitled Audiobook'}
                    </h3>
                    <p className="text-xs text-ink-muted line-clamp-1">
                      {project.author ? `By ${project.author}` : 'No author specified'}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line/40 pt-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Music className="size-3.5" />
                      {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-3.5" />
                      {totalMin}m {totalSec}s
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
