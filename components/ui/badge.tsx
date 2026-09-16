import type { ComponentProps } from 'react'
import { cn } from './cn'

const TONES = {
  neutral: 'bg-surface-2 text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning-soft text-warning',
} as const

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}
      {...props}
    />
  )
}
