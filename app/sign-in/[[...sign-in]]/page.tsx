import { redirect } from 'next/navigation'
import { SignIn } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export default function Page() {
  if (!isClerkConfigured()) redirect('/')
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <SignIn />
    </main>
  )
}
