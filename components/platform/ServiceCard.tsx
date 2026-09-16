import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ServiceCard({ service }: { service: ServiceDefinition }) {
  const live = service.availability === 'live'
  return (
    <Link
      href={service.href}
      className="group relative flex flex-col gap-5 rounded-card bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-7"
    >
      <div className="flex items-start justify-between">
        <span className={cn('grid size-12 place-items-center rounded-2xl text-ink shadow-subtle', service.tintClass)}>
          <ServiceIcon name={service.icon} className="size-6" />
        </span>
        {live ? <Badge tone="success">Available</Badge> : <Badge>Coming soon</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{service.name}</h2>
        <p className="text-ink-muted">{service.tagline}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        {live ? 'Open tool' : 'Learn more'}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
