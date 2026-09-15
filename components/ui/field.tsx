import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 aria-[invalid=true]:border-danger'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  const errorId = `${htmlFor}-error`
  const hintId = `${htmlFor}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const wiredChildren =
    isValidElement(children) && describedBy
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          'aria-describedby': (children.props as Record<string, unknown>)['aria-describedby'] ?? describedBy,
          'aria-invalid':
            (children.props as Record<string, unknown>)['aria-invalid'] ?? (error ? true : undefined),
        })
      : children

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {wiredChildren}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">{error}</p>
      ) : (
        hint && <p id={hintId} className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  )
}
