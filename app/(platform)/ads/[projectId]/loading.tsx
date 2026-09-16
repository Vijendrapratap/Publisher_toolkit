export default function ProjectStepLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-card bg-surface-2 shadow-inset" />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="h-72 animate-pulse rounded-card bg-surface-2 shadow-inset" />
        <div className="h-72 animate-pulse rounded-card bg-surface-2 shadow-inset" />
      </div>
    </div>
  )
}
