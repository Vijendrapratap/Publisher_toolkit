import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import { isClerkConfigured } from '@/lib/providers/auth'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Publisher Toolkit', template: '%s · Publisher Toolkit' },
  description: 'Tools for book publishers: ad creatives, trailers, audiobooks and landing pages.',
}

// Runs before paint so the saved or system theme never flashes.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const document = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )

  // Local mode: skip ClerkProvider so the browser never loads Clerk JS.
  return isClerkConfigured() ? <ClerkProvider>{document}</ClerkProvider> : document
}
