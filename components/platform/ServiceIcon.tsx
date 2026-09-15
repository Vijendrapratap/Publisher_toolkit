import { Clapperboard, Headphones, LayoutTemplate, Megaphone, type LucideIcon } from 'lucide-react'
import type { ServiceIconName } from '@/lib/services/registry'

const ICONS: Record<ServiceIconName, LucideIcon> = {
  megaphone: Megaphone,
  clapperboard: Clapperboard,
  headphones: Headphones,
  'layout-template': LayoutTemplate,
}

export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
  const Icon = ICONS[name]
  return <Icon className={className} aria-hidden />
}
