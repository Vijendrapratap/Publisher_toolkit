import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface-2 px-6 py-16 text-center shadow-inset">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent shadow-subtle">{icon}</span>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
