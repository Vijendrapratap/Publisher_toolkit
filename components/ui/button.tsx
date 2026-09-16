import type { ComponentProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

const VARIANTS = {
  primary: 'bg-accent text-on-accent shadow-subtle hover:bg-accent-strong active:shadow-inset',
  secondary: 'bg-surface text-ink shadow-card hover:bg-surface-2 active:shadow-inset',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white shadow-subtle hover:opacity-90 active:shadow-inset',
} as const

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = 'primary', size = 'md', className } = opts
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className
  )
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
