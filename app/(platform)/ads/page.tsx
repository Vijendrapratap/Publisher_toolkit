import Link from 'next/link'
import { Megaphone, Plus, Sparkles, Settings2, Upload, Images } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const HOW = [
  { icon: Upload, title: 'Upload', text: 'Drop in your book PDF. We pull the cover, title and blurb.' },
  { icon: Settings2, title: 'Configure', text: 'Choose platforms, a copy tone and a design template.' },
  { icon: Sparkles, title: 'Generate', text: 'AI writes the copy and composes every ad size.' },
  { icon: Images, title: 'Results', text: 'Polish the copy, download a ZIP, or push to your ad account.' },
]

export default async function AdsHomePage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getBooksForPublisher(publisherId)
  const newButton = (
    <Link href="/ads/new" className={buttonClasses({ size: 'lg' })}>
      <Plus className="size-4" aria-hidden /> New ad project
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Ads Creative</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ads that sell your book</h1>
      </header>
      {projects.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-7" aria-hidden />}
          title="Create your first ad set"
          description="Upload a book and get ready-to-run creatives for Meta, Google and Amazon in a few minutes."
          action={newButton}
        />
      ) : (
        <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Pick a project or start a new one</h2>
            <p className="text-sm text-ink-muted">Your projects are on the left, each resumes right where you left off.</p>
          </div>
          {newButton}
        </Card>
      )}
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xs font-semibold uppercase tracking-widest text-ink-muted">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HOW.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                {i + 1}. {title}
              </span>
              <p className="mt-3 text-sm text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
