import { notFound } from 'next/navigation'
import { Clapperboard } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { buildStepItems, statusDisplay } from '@/lib/services/trailer/steps'
import { Stepper } from '@/components/platform/Stepper'
import { Badge } from '@/components/ui/badge'

export default async function TrailerProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  const status = statusDisplay(project.status)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
            {project.frontCoverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.frontCoverUrl}
                alt={`Cover of ${project.title ?? 'this book'}`}
                className="size-full object-cover"
              />
            ) : (
              <Clapperboard className="size-6 text-ink-muted" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
              {project.title || 'Untitled book'}
            </h1>
            <p className="truncate text-sm text-ink-muted">{project.author || 'Unknown author'}</p>
          </div>
          <Badge tone={status.tone} className="ml-auto hidden sm:inline-flex">
            {status.label}
          </Badge>
        </div>
        <Stepper steps={buildStepItems(project.id, project.status, project.trailers.length > 0)} />
      </header>
      {children}
    </div>
  )
}
