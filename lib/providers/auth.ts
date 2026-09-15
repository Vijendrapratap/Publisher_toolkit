import { auth } from '@clerk/nextjs/server'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

// Local mode: no Clerk key (or the .env.example placeholder) means every
// request acts as one fixed local publisher. Set a real key and real auth
// takes over with no code change.
export const DEV_PUBLISHER_ID = 'dev-local-publisher'

export function isClerkConfigured(): boolean {
  const key = process.env.CLERK_SECRET_KEY
  return Boolean(key) && key !== 'sk_test_placeholder'
}

export async function requireCurrentPublisherId(): Promise<string> {
  if (!isClerkConfigured()) return DEV_PUBLISHER_ID
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()
  return userId
}
