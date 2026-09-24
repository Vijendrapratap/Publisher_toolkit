const PLACEHOLDERS = ['sk_test_placeholder', 'pk_test_placeholder']

/**
 * Both keys, not just the secret: mounting ClerkProvider and clerkMiddleware
 * with a secret but no publishable key crashes the app at boot.
 *
 * Deliberately its own file with no other imports. proxy.ts and
 * instrumentation.ts run in the Edge Runtime, which can't code-split a lazy
 * import — even `await import()` gets inlined into the edge bundle whole.
 * Importing this check from lib/providers/auth.ts instead (which pulls in
 * lib/credits/ledger.ts's Prisma client and node:crypto) drags those
 * Node-only deps into the edge bundle and breaks Prisma for every route.
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
