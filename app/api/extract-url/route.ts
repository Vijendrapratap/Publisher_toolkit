import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { rateLimited } from '@/lib/rateLimit'
import { extractBookFromUrl } from '@/lib/services/extract/urlExtractor'

export const maxDuration = 60

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  if (rateLimited(`extract:${publisherId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many imports this hour. Please try again later.' }, { status: 429 })
  }
  const body = await request.json().catch(() => ({}))
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Please provide a valid product or book URL.' }, { status: 400 })
  }

  try {
    const data = await extractBookFromUrl(url, publisherId)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('URL extraction error:', err)
    return NextResponse.json(
      { error: err.message || 'Could not extract book details from the provided URL. Please verify the link or enter details manually.' },
      { status: 422 }
    )
  }
}
