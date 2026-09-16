'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/components/ui/cn'

export interface StepItem {
  key: string
  label: string
  href: string
  complete: boolean
  reachable: boolean
}

export function Stepper({ steps }: { steps: StepItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2 overflow-x-auto sm:gap-3">
        {steps.map((step, index) => {
          const current = pathname.endsWith(`/${step.key}`)
          const circle = (
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                current && 'bg-accent text-on-accent shadow-subtle ring-4 ring-accent/20',
                !current && step.complete && 'bg-success text-on-accent',
                !current && !step.complete && 'bg-surface-2 text-ink-muted shadow-inset'
              )}
            >
              {step.complete && !current ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
          )
          const label = (
            <span className={cn('text-sm font-medium', current ? 'text-ink' : 'text-ink-muted')}>{step.label}</span>
          )
          return (
            <li key={step.key} className="flex items-center gap-2 sm:gap-3">
              {step.reachable ? (
                <Link
                  href={step.href}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-2"
                >
                  {circle}
                  {label}
                </Link>
              ) : (
                <span className="flex cursor-not-allowed items-center gap-2 py-1 pl-1 pr-3 opacity-60" aria-disabled="true">
                  {circle}
                  {label}
                </span>
              )}
              {index < steps.length - 1 && <span className="h-px w-6 shrink-0 bg-line sm:w-10" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
