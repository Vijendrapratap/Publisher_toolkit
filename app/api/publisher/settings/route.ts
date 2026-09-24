import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherSettings, savePublisherSettings, redactSettings } from '@/lib/publisher/settings'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const settings = await getPublisherSettings(publisherId)
  return NextResponse.json(redactSettings(settings))
}

export async function PATCH(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Defensive: a stale client from before BYOK was removed could still round-trip
  // an `ai` field from an old GET response. There's nothing left to update with it.
  const { ai: _ignored, ...updates } = body as Record<string, unknown>
  const updated = await savePublisherSettings(publisherId, updates)
  return NextResponse.json(redactSettings(updated))
}
