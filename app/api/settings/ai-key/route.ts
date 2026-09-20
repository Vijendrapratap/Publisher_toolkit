import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherSettings, savePublisherSettings, redactSettings } from '@/lib/publisher/settings'
import { isAiConfigured } from '@/lib/providers/ai'

const bodySchema = z.object({
  apiKey: z.string().trim().min(1, 'OpenRouter API key is required'),
  model: z.string().trim().max(120).optional(),
  /** Verify the key against OpenRouter without storing it. */
  testOnly: z.boolean().optional(),
})

async function verifyKey(apiKey: string): Promise<string | null> {
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.ok) return null
  const body = await res.json().catch(() => ({}) as { error?: { message?: string } })
  return body?.error?.message || `OpenRouter returned HTTP ${res.status}`
}

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const settings = await getPublisherSettings(publisherId)
  const { ai } = redactSettings(settings)

  return NextResponse.json({
    ...ai,
    // True when either the publisher's own key or the server's key will work.
    isConfigured: isAiConfigured({ apiKey: settings.ai.openRouterKey }),
  })
}

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { apiKey, model, testOnly } = parsed.data

  let problem: string | null
  try {
    problem = await verifyKey(apiKey)
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach OpenRouter: ${err instanceof Error ? err.message : 'network error'}` },
      { status: 502 }
    )
  }
  if (problem) {
    return NextResponse.json({ error: `Invalid OpenRouter key: ${problem}` }, { status: 400 })
  }

  if (testOnly) {
    return NextResponse.json({ success: true, message: 'OpenRouter API key is valid and connected.' })
  }

  // Stored against this publisher, not written into the server's environment:
  // one publisher's key must not become every publisher's key.
  const saved = await savePublisherSettings(publisherId, { ai: { openRouterKey: apiKey, model } })
  const { ai } = redactSettings(saved)

  return NextResponse.json({ success: true, isConfigured: true, ...ai })
}

export async function DELETE() {
  const publisherId = await requireCurrentPublisherId()
  await savePublisherSettings(publisherId, { ai: { openRouterKey: undefined, model: undefined } })
  return NextResponse.json({ success: true })
}
