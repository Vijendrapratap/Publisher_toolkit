import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-8 flex flex-col gap-4 items-start">
      <h1 className="text-2xl font-semibold">Publisher Toolkit — Ads Creative</h1>
      <p className="text-gray-600">
        Upload a book and generate platform-sized ad creatives with AI-written copy.
      </p>
      <Link href="/dashboard" className="bg-black text-white rounded px-4 py-2">
        Go to dashboard
      </Link>
    </main>
  )
}
