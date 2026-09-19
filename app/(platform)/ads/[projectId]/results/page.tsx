import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Download, RefreshCw, ShoppingBag } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { PLATFORMS } from '@/lib/services/ads/options'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreativeGallery } from '@/components/ads/CreativeGallery'
import { CopyEditor } from '@/components/ads/CopyEditor'
import { AmazonPackagePanel } from '@/components/ads/AmazonPackagePanel'

export default async function ResultsStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) redirect(`/ads/${book.id}/configure`)

  const sections = PLATFORMS.map((p) => ({
    ...p,
    images: set.images.filter((i) => i.platform === p.key),
    copy: set.adCopies.find((c) => c.platform === p.key),
  })).filter((s) => s.images.length > 0 || s.copy)

  const primaryCopy = set.adCopies.find((c) => c.platform === 'AMAZON') || set.adCopies[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-accent" />
            <h2 className="font-display text-2xl font-semibold tracking-tight">Amazon Campaign & A+ Content Package</h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {set.images.length} creative modules{set.videoUrl ? ' and 1 HD video trailer' : ''} generated for Amazon KDP and Advertising.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/ads/${book.id}/configure`} className={buttonClasses({ variant: 'ghost' })}>
            <RefreshCw className="size-4" aria-hidden /> Regenerate
          </Link>
          <a href={`/api/ads/projects/${book.id}/download`} className={buttonClasses({ variant: 'secondary' })}>
            <Download className="size-4" aria-hidden /> Download all (.zip)
          </a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {sections.map((s) => (
            <Card key={s.key} className="flex flex-col gap-5 p-6">
              <div>
                <h3 className="font-display text-xl font-semibold">{s.label}</h3>
                <p className="text-sm text-ink-muted">{s.description}</p>
              </div>
              <CreativeGallery
                images={s.images}
                platformLabel={s.label}
                video={{
                  videoUrl: set.videoUrl,
                  videoPosterUrl: set.videoPosterUrl,
                  videoDuration: set.videoDuration,
                }}
              />
              {s.copy && (
                <div className="rounded-2xl bg-surface p-5 shadow-subtle">
                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-muted">Amazon Ad & Product Copy</h4>
                  <CopyEditor copy={{ ...s.copy, platform: s.copy.platform as AdPlatform }} />
                </div>
              )}
            </Card>
          ))}
        </div>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <AmazonPackagePanel
            projectId={book.id}
            title={book.title ?? 'Untitled book'}
            copy={primaryCopy}
            hasVideo={Boolean(set.videoUrl)}
            imageCount={set.images.length}
          />
        </aside>
      </div>
    </div>
  )
}
