import { notFound, redirect } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { goalSizes, goalWantsVideo } from '@/lib/services/ads/goal'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { GenerateRunner } from '@/components/platform/GenerateRunner'

const STAGES = [
  'Synthesizing book metadata',
  'Writing ad copy with AI',
  'Composing banner creatives',
  'Finalizing ad package',
]

export default async function GenerateStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  if (book.status === 'uploaded') redirect(`/ads/${book.id}/configure`)
  if (!book.frontCoverUrl) redirect(`/ads/${book.id}/upload`)
  // Revisiting this page (back button, pasted URL) would otherwise mount the
  // runner again and POST a second, redundant generation.
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (book.status === 'generated' && set) redirect(`/ads/${book.id}/results`)

  const sizeCount = goalSizes(book.contentGoal, book.platforms as AdPlatform[]).length
  const wantsVideo = goalWantsVideo(book.contentGoal, book.includeVideo)
  const makes = [sizeCount > 0 ? `${sizeCount} image sizes` : null, wantsVideo ? 'a video trailer' : null]
    .filter(Boolean)
    .join(' and ')
  const stages = sizeCount > 0 ? STAGES : ['Synthesizing book metadata', 'Writing ad copy with AI', 'Rendering video trailer', 'Finalizing ad package']

  return (
    <GenerateRunner
      endpoint={`/api/ads/projects/${book.id}/generate`}
      successHref={`/ads/${book.id}/results`}
      cancelHref={`/ads/${book.id}/configure`}
      title="Creating your ads"
      subtitle={`Making ${makes || 'your ad copy'}. This usually takes under a minute.`}
      stages={stages}
      icon={<Loader2 className="size-7 animate-spin" aria-hidden />}
      successMessage="Your creatives are ready"
      footnote={
        <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-line/70 bg-surface-2/60 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-accent shadow-subtle">
            <ShieldCheck className="size-3.5" aria-hidden />
            Text-only prompt • no interior images processed
          </span>
          <p className="text-xs text-ink-muted">Full book text and images are never sent to the AI model.</p>
        </div>
      }
    />
  )
}
