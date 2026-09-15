import { auth } from '@clerk/nextjs/server'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

// Local dev without real Clerk credentials: .env.local's placeholder key
// (see .env.example) lets the app build, but the real Clerk SDK rejects it
// outright. While that literal placeholder is in place, skip Clerk and fall
// back to a fixed local publisher id — swap in a real key and this stops
// firing automatically.
const DEV_PUBLISHER_ID = 'dev-local-publisher'
export function isClerkConfigured(): boolean {
  return process.env.CLERK_SECRET_KEY !== 'sk_test_placeholder'
}

export async function requireCurrentPublisherId(): Promise<string> {
  if (!isClerkConfigured()) return DEV_PUBLISHER_ID
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()
  return userId
}
