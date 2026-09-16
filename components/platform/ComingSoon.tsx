import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ComingSoon({ service }: { service: ServiceDefinition }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <span className={cn('grid size-20 place-items-center rounded-3xl text-ink shadow-subtle', service.tintClass)}>
        <ServiceIcon name={service.icon} className="size-9" />
      </span>
      <Badge className="mt-6">Coming soon</Badge>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{service.name}</h1>
      <p className="mt-4 text-lg text-ink-muted">{service.description}</p>
      <ul className="mt-8 flex flex-col gap-3 text-left">
        {service.highlights.map((h) => (
          <li key={h} className="flex items-center gap-3">
            <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent shadow-subtle">
              <Check className="size-3.5" aria-hidden />
            </span>
            {h}
          </li>
        ))}
      </ul>
      <Link href="/" className={buttonClasses({ variant: 'secondary', className: 'mt-10' })}>
        <ArrowLeft className="size-4" aria-hidden /> Back to all tools
      </Link>
    </div>
  )
}
