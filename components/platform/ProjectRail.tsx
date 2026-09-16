import Link from 'next/link'
import { BookImage, Plus } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/format'
import { statusDisplay } from '@/lib/services/ads/steps'
import { RailLink } from './RailLink'

export interface RailProject {
  id: string
  title: string | null
  status: string
  frontCoverUrl: string | null
  updatedAt: Date
}

export function ProjectRail({ projects, newHref, basePath }: { projects: RailProject[]; newHref: string; basePath: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href={newHref} className={buttonClasses({ className: 'w-full' })}>
        <Plus className="size-4" aria-hidden /> New project
      </Link>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Your projects</h2>
        <span className="text-xs text-ink-muted">{projects.length}</span>
      </div>
      {projects.length === 0 ? (
        <p className="px-1 text-sm text-ink-muted">Projects you create will show up here.</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {projects.map((p) => {
            const status = statusDisplay(p.status)
            return (
              <li key={p.id} className="min-w-56 lg:min-w-0">
                <RailLink href={`${basePath}/${p.id}`}>
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 shadow-inset">
                    {p.frontCoverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.frontCoverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <BookImage className="size-5 text-ink-muted" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{p.title || 'Untitled book'}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                    </span>
                  </span>
                </RailLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
