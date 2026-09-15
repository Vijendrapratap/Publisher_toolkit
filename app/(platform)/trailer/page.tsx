import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Trailer Video' }

export default function TrailerPage() {
  return <ComingSoon service={getService('trailer')} />
}
