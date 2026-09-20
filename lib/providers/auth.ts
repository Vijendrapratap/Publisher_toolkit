import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

// Local mode: no Clerk keys (or the .env.example placeholders) means every
// request acts as one fixed local publisher. Set real keys and real auth takes
// over with no code change.
export const DEV_PUBLISHER_ID = 'dev-local-publisher'
export const PUBLISHER_COOKIE = 'pt_publisher_id'

const PLACEHOLDERS = ['sk_test_placeholder', 'pk_test_placeholder']

/**
 * Both keys, not just the secret: mounting ClerkProvider and clerkMiddleware
 * with a secret but no publishable key crashes the app at boot.
 */
export function isClerkConfigured(): boolean {
  const secret = process.env.CLERK_SECRET_KEY
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  return (
    Boolean(secret && publishable) &&
    !PLACEHOLDERS.includes(secret!) &&
    !PLACEHOLDERS.includes(publishable!)
  )
}

export async function requireCurrentPublisherId(): Promise<string> {
  if (isClerkConfigured()) {
    const { userId } = await auth()
    if (!userId) throw new UnauthenticatedError()
    return userId
  }

  // Deliberately not wrapped in try/catch. `cookies()` throws a control-flow
  // signal during prerendering that Next uses to mark the route dynamic;
  // swallowing it let pages bake in the dev publisher's data at build time.
  const sessionCookie = (await cookies()).get(PUBLISHER_COOKIE)?.value
  return sessionCookie || DEV_PUBLISHER_ID
}
