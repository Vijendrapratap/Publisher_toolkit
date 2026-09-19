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
  if (isClerkConfigured()) {
    const { userId } = await auth()
    if (!userId) throw new UnauthenticatedError()
    return userId
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('pt_publisher_id')?.value
    if (sessionCookie) return sessionCookie
  } catch {
    // Falls back gracefully outside Next.js request context (e.g. tests or build)
  }

  return DEV_PUBLISHER_ID
}
