import { SERVICES } from '@/lib/services/registry'
import { ServiceCard } from '@/components/platform/ServiceCard'

export default function HubPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Publisher Toolkit</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Every tool your book needs to find its readers.
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Pick a tool to get started. Each one keeps its own projects, so you can focus on one thing at a time.
        </p>
      </header>
      <section aria-label="Tools" className="mt-10 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </section>
    </div>
  )
}
