import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import { isClerkConfigured } from '@/lib/providers/auth'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Publisher Toolkit', template: '%s · Publisher Toolkit' },
  description: 'Tools for book publishers: book creation, ad creatives and video ads.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const document = (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )

  // Local mode: skip ClerkProvider so the browser never loads Clerk JS.
  return isClerkConfigured() ? <ClerkProvider>{document}</ClerkProvider> : document
}
