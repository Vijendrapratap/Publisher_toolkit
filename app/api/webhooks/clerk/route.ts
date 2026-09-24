import type { NextRequest } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { ensureUser } from '@/lib/credits/ledger'

/** Signature-verified with CLERK_WEBHOOK_SIGNING_SECRET. Public: Clerk calls it signed-out. */
export async function POST(request: NextRequest) {
  let event
  try {
    event = await verifyWebhook(request)
  } catch {
    return Response.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, primary_email_address_id, email_addresses } = event.data
    const email = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? ''
    await ensureUser(id, async () => email)
  }
  return Response.json({ ok: true })
}
