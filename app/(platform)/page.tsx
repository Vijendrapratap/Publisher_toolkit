import Link from 'next/link'
import { BookImage } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProjects } from '@/lib/services/ads/projects'
import { getCreatorProjectsForPublisher } from '@/lib/services/creator/queries'
import { mergeRecentWork } from '@/lib/services/shared/recentWork'
import { timeAgo } from '@/lib/format'
import { ServiceCard } from '@/components/platform/ServiceCard'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const publisherId = await requireCurrentPublisherId()
  const [adsProjects, books] = await Promise.all([getAdsProjects(publisherId), getCreatorProjectsForPublisher(publisherId)])
  const recent = mergeRecentWork(adsProjects, books, 4)

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Publisher Toolkit</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tighter text-balance sm:text-5xl">
          Every tool your book needs to find its readers.
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Pick a tool to get started. Each one keeps its own projects, so you can focus on one thing at a time.
        </p>
      </header>

      <section aria-label="Tools" className="mt-10 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-14">
          <h2 id="recent-heading" className="font-display text-2xl font-semibold tracking-tight">
            Pick up where you left off
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => (
              <li key={p.key}>
                <Link
                  href={p.href}
                  className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-surface-2 shadow-inset">
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <BookImage className="size-8 text-ink-muted" aria-hidden />
                    )}
                  </span>
                  <span className="flex flex-col gap-2 p-4">
                    <span className="text-xs font-medium text-accent">{p.kind === 'ads' ? 'Ads Creative' : 'Create Your Book'}</span>
                    <span className="truncate font-medium">{p.title}</span>
                    <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
