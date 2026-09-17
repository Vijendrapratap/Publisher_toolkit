import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherSettings, savePublisherSettings } from '@/lib/publisher/settings'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const settings = await getPublisherSettings(publisherId)
  return NextResponse.json(settings, { status: 200 })
}

export async function PATCH(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const updated = await savePublisherSettings(publisherId, body)
  return NextResponse.json(updated, { status: 200 })
}
