'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ServiceSwitcher({ services }: { services: ServiceDefinition[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = services.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        {current ? <ServiceIcon name={current.icon} className="size-4 text-accent" /> : <LayoutGrid className="size-4 text-accent" aria-hidden />}
        {current?.name ?? 'All tools'}
        <ChevronDown className={cn('size-4 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-11 z-50 w-72 rounded-2xl border border-line bg-surface p-2 shadow-lift">
          <Link role="menuitem" href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            <LayoutGrid className="size-4 text-ink-muted" aria-hidden /> All tools
          </Link>
          <div className="my-1 h-px bg-line" />
          {services.map((s) => (
            <Link
              key={s.key}
              role="menuitem"
              href={s.href}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2', current?.key === s.key && 'bg-surface-2')}
            >
              <span className={cn('grid size-8 place-items-center rounded-lg', s.tintClass)}>
                <ServiceIcon name={s.icon} className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{s.name}</span>
                {s.availability === 'coming-soon' && <span className="text-xs text-ink-muted">Coming soon</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
