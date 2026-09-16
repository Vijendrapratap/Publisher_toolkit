import Link from 'next/link'
import { BookImage } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'
import { statusDisplay } from '@/lib/services/ads/steps'
import { timeAgo } from '@/lib/format'
import { ServiceCard } from '@/components/platform/ServiceCard'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const publisherId = await requireCurrentPublisherId()
  const recent = (await getBooksForPublisher(publisherId)).slice(0, 4)

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
            {recent.map((p) => {
              const status = statusDisplay(p.status)
              return (
                <li key={p.id}>
                  <Link
                    href={`/ads/${p.id}`}
                    className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span className="grid aspect-[4/3] place-items-center bg-surface-2 shadow-inset">
                      {p.frontCoverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.frontCoverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <BookImage className="size-8 text-ink-muted" aria-hidden />
                      )}
                    </span>
                    <span className="flex flex-col gap-2 p-4">
                      <span className="text-xs font-medium text-accent">Ads Creative</span>
                      <span className="truncate font-medium">{p.title || 'Untitled book'}</span>
                      <span className="flex items-center justify-between gap-2">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
