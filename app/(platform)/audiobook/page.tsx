import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Audio Book (Coming Soon)' }

export default function AudiobookPage() {
  return <ComingSoon service={getService('audiobook')} />
}
