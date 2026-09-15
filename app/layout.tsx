import { ClerkProvider } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  )

  // Local dev without real Clerk credentials (see lib/auth.ts) — skip
  // ClerkProvider entirely so the browser never tries to load real Clerk JS
  // for a placeholder key.
  return isClerkConfigured() ? <ClerkProvider>{body}</ClerkProvider> : body
}
