import Link from 'next/link'
import { Clapperboard, Film, Music2, Plus, Sparkles, Upload } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectsForPublisher } from '@/lib/services/trailer/queries'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const HOW = [
  {
    icon: Upload,
    title: 'Upload',
    text: 'Drop in your book PDF. We pull the cover art, title, author, and blurb.',
  },
  {
    icon: Film,
    title: 'Configure',
    text: 'Select video duration (15s, 30s, 60s), visual theme, and aspect ratios.',
  },
  {
    icon: Music2,
    title: 'Soundtrack',
    text: 'Choose a genre-matched mood for the synthesized background audio.',
  },
  {
    icon: Sparkles,
    title: 'Results',
    text: 'Stream your video cuts, preview poster frames, or download the full ZIP.',
  },
]

export default async function TrailerHomePage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getTrailerProjectsForPublisher(publisherId)
  const newButton = (
    <Link href="/trailer/new" className={buttonClasses({ size: 'lg' })}>
      <Plus className="size-4" aria-hidden /> New trailer project
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Trailer Video</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Cinematic trailers that sell the story
        </h1>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="size-7" aria-hidden />}
          title="Create your first book trailer"
          description="Turn your book PDF into short, shareable book trailers for TikTok, Reels, Shorts and YouTube."
          action={newButton}
        />
      ) : (
        <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Pick a project or create a new trailer</h2>
            <p className="text-sm text-ink-muted">
              Select a project from the left rail to resume editing or watch your generated trailers.
            </p>
          </div>
          {newButton}
        </Card>
      )}

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HOW.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-card bg-surface p-5 shadow-subtle">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent shadow-subtle">
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
