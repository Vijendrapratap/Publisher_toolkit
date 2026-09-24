// Imported from the leaf module, not '@/lib/providers/auth' — see
// lib/providers/clerk-config.ts for why.
import { isClerkConfigured } from '@/lib/providers/clerk-config'

export function register() {
  if (process.env.NODE_ENV === 'production' && !isClerkConfigured()) {
    throw new Error('Refusing to start: set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.')
  }
}
