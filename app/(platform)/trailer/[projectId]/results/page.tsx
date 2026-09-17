import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Download, RefreshCw } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { buttonClasses } from '@/components/ui/button'
import { TrailerPlayerGallery } from '@/components/trailer/TrailerPlayerGallery'

export default async function TrailerResultsStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()
  if (!project.trailers || project.trailers.length === 0) {
    redirect(`/trailer/${project.id}/configure`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Your book trailers</h2>
          <p className="text-sm text-ink-muted">
            {project.trailers.length} video cut{project.trailers.length === 1 ? '' : 's'} ready for Reels, Shorts, Feed, and YouTube.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/trailer/${project.id}/configure`} className={buttonClasses({ variant: 'ghost' })}>
            <RefreshCw className="size-4" aria-hidden /> Reconfigure
          </Link>
          <a
            href={`/api/trailer/projects/${project.id}/download`}
            className={buttonClasses({ variant: 'secondary' })}
          >
            <Download className="size-4" aria-hidden /> Download all (.zip)
          </a>
        </div>
      </div>

      <TrailerPlayerGallery
        trailers={project.trailers}
        metadata={{
          title: project.title ?? '',
          author: project.author ?? '',
          style: project.style,
          musicMood: project.musicMood,
          length: project.length,
        }}
      />
    </div>
  )
}
