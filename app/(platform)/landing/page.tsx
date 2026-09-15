import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Landing Page & Website' }

export default function LandingPage() {
  return <ComingSoon service={getService('landing')} />
}
