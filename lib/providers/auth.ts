import { auth, currentUser } from '@clerk/nextjs/server'
import { connection } from 'next/server'
import { ensureUser } from '@/lib/credits/ledger'

export { isClerkConfigured } from './clerk-config'
import { isClerkConfigured } from './clerk-config'

// Local mode: no Clerk keys (or the .env.example placeholders) means every
// request acts as one fixed local publisher — development only.
export const DEV_PUBLISHER_ID = 'dev-local-publisher'

/**
 * The resource-level auth check (Clerk's replacement for middleware route
 * matching): signed-out page requests redirect to sign-in, signed-out API
 * requests get a non-2xx from Clerk. Also guarantees the user's credit row.
 */
export async function requireCurrentPublisherId(): Promise<string> {
  if (isClerkConfigured()) {
    const { userId } = await auth.protect()
    await ensureUser(userId, async () => (await currentUser())?.primaryEmailAddress?.emailAddress ?? '')
    return userId
  }

  // Marks the route dynamic, so pages never bake the dev publisher's data in at build time.
  await connection()
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Clerk keys are required in production; the local dev publisher is disabled.')
  }
  await ensureUser(DEV_PUBLISHER_ID, async () => 'dev@localhost')
  return DEV_PUBLISHER_ID
}
