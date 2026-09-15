import { FlaskConical } from 'lucide-react'
import { getCapabilityStatus } from '@/lib/providers/status'
import { Badge } from '@/components/ui/badge'

const LABELS = { auth: 'Sign-in', storage: 'File storage', ai: 'AI copy', adsPush: 'Ad account push' } as const

export function LocalModeBadge() {
  const status = getCapabilityStatus()
  const simulated = (Object.keys(LABELS) as (keyof typeof LABELS)[]).filter((k) => status[k] === 'local')
  if (simulated.length === 0) return null
  const detail = `Running locally. Simulated: ${simulated.map((k) => LABELS[k]).join(', ')}.`
  return (
    <Badge tone="warning" title={detail} className="hidden sm:inline-flex">
      <FlaskConical className="size-3.5" aria-hidden />
      Local mode
      <span className="sr-only">{detail}</span>
    </Badge>
  )
}
