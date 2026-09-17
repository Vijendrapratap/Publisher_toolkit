import { notFound } from 'next/navigation'
import { Headphones } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { buildStepItems, statusDisplay } from '@/lib/services/audiobook/steps'
import { Stepper } from '@/components/platform/Stepper'
import { Badge } from '@/components/ui/badge'

export default async function AudiobookProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  const status = statusDisplay(project.status)
  const hasAudio = Boolean(project.fullAudioUrl || project.chapters.some((c) => c.duration > 0))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
            {project.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.coverUrl}
                alt={`Cover of ${project.title ?? 'this book'}`}
                className="size-full object-cover"
              />
            ) : (
              <Headphones className="size-6 text-accent opacity-50" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
              {project.title || 'Untitled Audiobook'}
            </h1>
            <p className="truncate text-sm text-ink-muted">
              {project.author || 'Unknown author'} • {project.chapters.length} chapters
            </p>
          </div>
          <Badge tone={status.tone} className="ml-auto hidden sm:inline-flex">
            {status.label}
          </Badge>
        </div>
        <Stepper steps={buildStepItems(project.id, project.status, hasAudio)} />
      </header>
      {children}
    </div>
  )
}
