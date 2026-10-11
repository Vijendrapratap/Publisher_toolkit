import type { Metadata } from 'next'

export const metadata: Metadata = { title: { default: 'Ads Creative', template: '%s · Ads Creative' } }

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-10">{children}</div>
}
