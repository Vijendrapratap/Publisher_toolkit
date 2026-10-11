import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookImage, Film } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProject } from '@/lib/services/ads/projects'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { ASSET_KINDS, ASSET_LABELS, type AssetGroup, type AssetKind, type AssetVersion } from '@/lib/services/ads/projectAssets'
import { goalCreditLabel } from '@/lib/credits/prices'
import { timeAgo } from '@/lib/format'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreateAssetButton } from '@/components/ads/CreateAssetButton'
import { EditBookDetails } from '@/components/ads/EditBookDetails'

export const dynamic = 'force-dynamic'

export default async function AdsBookProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAdsProject(publisherId, id)
  if (!project) {
    // Old links point at a creation; send them to its book.
    const book = await getBookForPublisher(publisherId, id)
    if (book?.parentBookId) redirect(`/ads/books/${book.parentBookId}`)
    notFound()
  }
  const { root, groups } = project

  return (
    <div className="flex flex-col gap-6">
      <Link href="/ads" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Your books
      </Link>

      <header className="flex flex-wrap items-center gap-5">
        <span className="grid aspect-[3/4] w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
          {root.frontCoverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={root.frontCoverUrl} alt={`Cover of ${root.title ?? 'this book'}`} className="size-full object-cover" />
          ) : (
            <BookImage className="size-6 text-ink-muted" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{root.title || 'Untitled book'}</h1>
          {root.author && <p className="mt-1 text-ink-muted">{root.author}</p>}
          <div className="mt-2">
            {root.creatorProjectId ? (
              <Link href={`/create-book/${root.creatorProjectId}`} className="text-sm font-medium text-accent hover:underline">
                Written in Create a book — Open book
              </Link>
            ) : (
              <EditBookDetails rootId={root.id} title={root.title ?? ''} author={root.author ?? ''} />
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="make-heading">
        <h2 id="make-heading" className="font-display text-xl font-semibold">What do you want to make?</h2>
        <Card className="mt-4 divide-y divide-line">
          <ul className="divide-y divide-line">
            {ASSET_KINDS.map((kind) => (
              <AssetRow key={kind} rootId={root.id} kind={kind} group={groups[kind]} />
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}

function AssetRow({ rootId, kind, group }: { rootId: string; kind: AssetKind; group: AssetGroup }) {
  const { latest, earlier, draftRowId } = group
  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 sm:w-52">
        <h3 className="font-medium">{ASSET_LABELS[kind]}</h3>
        <p className="text-sm text-ink-muted">
          {latest ? `Made ${timeAgo(latest.createdAt)}` : `Not made yet · ${goalCreditLabel(kind)}`}
        </p>
      </div>
      <div className="flex flex-1 gap-2">{latest && <Preview version={latest} />}</div>
      <div className="flex flex-wrap items-center gap-2">
        {latest && (
          <Link href={`/ads/${latest.rowId}/results`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            View
          </Link>
        )}
        {/* One unfinished item at a time: finish it rather than starting another. */}
        {draftRowId ? (
          <Link href={`/ads/${draftRowId}`} className={buttonClasses({ size: 'sm' })}>
            Continue unfinished
          </Link>
        ) : (
          <CreateAssetButton rootId={rootId} kind={kind} label={latest ? 'Create new' : 'Create'} />
        )}
      </div>
      {earlier.length > 0 && (
        <details className="text-sm text-ink-muted sm:basis-full">
          <summary className="cursor-pointer">
            {earlier.length} earlier {earlier.length === 1 ? 'version' : 'versions'}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-3">
            {earlier.map((v) => (
              <li key={`${v.rowId}-${v.createdAt.getTime()}`}>
                <Link href={`/ads/${v.rowId}/results`} className="text-accent hover:underline">
                  {timeAgo(v.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function Preview({ version }: { version: AssetVersion }) {
  if (version.videoUrl) {
    return (
      <span className="relative grid h-16 w-28 place-items-center overflow-hidden rounded-lg bg-surface-2 shadow-inset">
        {version.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={version.posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <Film className="size-5 text-ink-muted" aria-hidden />
        )}
        {version.durationSec && (
          <span className="absolute bottom-1 right-1 rounded bg-ink/70 px-1 text-[10px] text-canvas">0:{String(version.durationSec).padStart(2, '0')}</span>
        )}
      </span>
    )
  }
  return (
    <>
      {version.imageUrls.slice(0, 3).map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" className="h-16 w-auto rounded-lg object-cover shadow-subtle" />
      ))}
    </>
  )
}
