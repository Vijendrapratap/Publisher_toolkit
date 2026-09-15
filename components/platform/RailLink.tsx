'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function RailLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2',
        active && 'bg-surface-2 ring-1 ring-line'
      )}
    >
      {children}
    </Link>
  )
}
