import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
// Imported from the leaf module, not '@/lib/providers/auth': that file also
// pulls in lib/credits/ledger.ts (Prisma, node:crypto), which the Edge
// Runtime here can't code-split away — see lib/providers/clerk-config.ts.
import { isClerkConfigured } from '@/lib/providers/clerk-config'

// Auth is enforced per resource by requireCurrentPublisherId() (every API
// route and platform page calls it), not by path matching here — Clerk
// deprecated createRouteMatcher because matchers drift from Next's routing.
// Public by construction: /sign-in, /sign-up, /p/:slug, /api/webhooks/clerk.
export default isClerkConfigured() ? clerkMiddleware() : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
