import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { ServiceSwitcher } from './ServiceSwitcher'
import { LocalModeBadge } from './LocalModeBadge'
import { ThemeToggle } from './ThemeToggle'
import { AccountChip } from './AccountChip'

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-canvas/80 shadow-subtle backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent shadow-subtle">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">Publisher Toolkit</span>
        </Link>
        <div className="mx-2 hidden h-6 w-px bg-line sm:block" />
        <ServiceSwitcher services={SERVICES} />
        <div className="ml-auto flex items-center gap-2">
          <LocalModeBadge />
          <ThemeToggle />
          <AccountChip />
        </div>
      </div>
    </header>
  )
}
