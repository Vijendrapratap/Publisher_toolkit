import { SignIn } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'
import { LoginForm } from '@/components/auth/LoginForm'

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6">
        <LoginForm />
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <SignIn />
    </main>
  )
}
