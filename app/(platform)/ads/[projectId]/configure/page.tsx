import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { ConfigureForm } from '@/components/ads/ConfigureForm'
import type { AdPlatform } from '@/lib/services/ads/copy'
import type { CopyTone, TemplateKey } from '@/lib/services/ads/options'

export default async function ConfigureStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { projectId } = await params
  const { error } = await searchParams
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()

  return (
    <ConfigureForm
      projectId={book.id}
      error={error}
      initial={{
        platforms: book.platforms as AdPlatform[],
        copyTone: book.copyTone as CopyTone,
        templateKey: book.templateKey as TemplateKey,
        campaignName: book.campaignName,
        campaignObjective: book.campaignObjective,
        targetAudience: book.targetAudience,
        customHook: book.customHook,
        ctaText: book.ctaText,
      }}
      book={{ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '', coverUrl: book.frontCoverUrl }}
    />
  )
}
