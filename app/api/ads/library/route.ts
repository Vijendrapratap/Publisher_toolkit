import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherBookLibrary } from '@/lib/services/ads/queries'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const books = await getPublisherBookLibrary(publisherId)
  return NextResponse.json({ books })
}
