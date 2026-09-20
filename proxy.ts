import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isClerkConfigured } from '@/lib/providers/auth'

// Anchored so only the sign-in and sign-up routes themselves are public —
// the unanchored version also exempted paths like /sign-in-anything.
// `/p/:slug` is a published book site and is public by design.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/p/(.*)'])

// Local dev without real Clerk credentials: Clerk's own middleware rejects the
// placeholder key outright, so skip it entirely and let
// requireCurrentPublisherId()'s dev fallback handle auth downstream.
export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) await auth.protect()
    })
  : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
