import { UserButton } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export function AccountChip() {
  if (isClerkConfigured()) return <UserButton />
  return (
    <div className="flex items-center gap-2" aria-label="Signed in as Local publisher">
      <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent">LP</span>
      <span className="hidden text-sm font-medium md:inline">Local publisher</span>
    </div>
  )
}
