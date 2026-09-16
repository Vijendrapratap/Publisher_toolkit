import type { ComponentProps } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('font-display text-xl font-semibold tracking-tight text-ink', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-ink-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-3', className)} {...props} />
}
