import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherTrailerBookLibrary } from '@/lib/services/trailer/queries'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const books = await getPublisherTrailerBookLibrary(publisherId)
  return NextResponse.json({ books })
}
