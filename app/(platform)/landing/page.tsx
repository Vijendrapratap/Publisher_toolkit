import Link from 'next/link'
import type { Metadata } from 'next'
import { LayoutTemplate, Plus, ExternalLink, Globe, Palette } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { listLandingProjectsForPublisher } from '@/lib/services/landing/queries'
import { statusDisplay, stepHref, resumeStep } from '@/lib/services/landing/steps'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Landing Page & Website' }

export default async function LandingPage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await listLandingProjectsForPublisher(publisherId)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-tint-landing text-accent shadow-card">
              <LayoutTemplate className="size-5" />
            </span>
            Landing Page & Website
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Generate high-converting, responsive landing pages and websites for your books with instant public links and HTML export.
          </p>
        </div>

        <Link href="/landing/new">
          <Button size="lg" className="w-full sm:w-auto shadow-card">
            <Plus className="size-4" /> Create Landing Page
          </Button>
        </Link>
      </div>

      {/* Projects List or Empty State */}
      {projects.length === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center border-dashed">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
            <LayoutTemplate className="size-7 opacity-40" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">No landing pages created yet</h3>
          <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">
            Upload your book PDF or enter details to generate a high-converting landing page with 3D cover showcase and retailer links.
          </p>
          <Link href="/landing/new" className="mt-5">
            <Button variant="primary">
              <Plus className="size-4" /> Create First Landing Page
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasPublished = Boolean(project.publishedSlug)
            const targetStep = resumeStep(project.status, hasPublished)
            const status = statusDisplay(project.status)

            return (
              <Link key={project.id} href={stepHref(project.id, targetStep)} className="group">
                <Card className="flex h-full flex-col justify-between p-5 transition-all hover:border-accent/60 hover:shadow-card">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-muted uppercase">
                        {project.template}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>

                    <h3 className="mt-3 font-display text-base font-semibold group-hover:text-accent transition-colors line-clamp-1">
                      {project.title || 'Untitled Book'}
                    </h3>
                    <p className="text-xs text-ink-muted line-clamp-1">
                      {project.author ? `By ${project.author}` : 'No author specified'}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line/40 pt-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Globe className="size-3.5" />
                      {project.publishedSlug ? `/p/${project.publishedSlug}` : 'Unpublished'}
                    </span>
                    <span className="capitalize">{project.theme} Theme</span>
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
