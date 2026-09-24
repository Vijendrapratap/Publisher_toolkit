import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-ink">Local mode — you&apos;re signed in as the local publisher.</p>
          <Link href="/" className="text-sm font-medium text-accent underline">
            Go to the app
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <SignUp />
    </main>
  )
}
