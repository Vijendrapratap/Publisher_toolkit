import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { isAiConfigured } from '@/lib/providers/ai'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import {
  toTrailerAspectRatio,
  toTrailerLength,
  toTrailerMusicMood,
  toTrailerStyle,
} from '@/lib/services/trailer/options'
import { inferPreset } from '@/lib/services/videoad/presets'
import { TrailerConfigureForm } from '@/components/trailer/TrailerConfigureForm'

export default async function TrailerConfigureStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { projectId } = await params
  const { error } = await searchParams
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  const credentials = await getPublisherAiCredentials(publisherId)

  return (
    <TrailerConfigureForm
      projectId={project.id}
      error={error}
      // Only offer the photographic background when a key will actually answer.
      aiConfigured={isAiConfigured({ apiKey: credentials.apiKey })}
      proof={{ rating: project.rating, reviewCount: project.reviewCount, price: project.price }}
      initial={{
        aspectRatios: (project.aspectRatios.length > 0 ? project.aspectRatios : ['1:1', '16:9']).map((a) =>
          toTrailerAspectRatio(a)
        ),
        length: toTrailerLength(project.length),
        style: toTrailerStyle(project.style),
        musicMood: toTrailerMusicMood(project.musicMood),
        hookText: project.hookText,
        ctaText: project.ctaText,
        // A project imported before the preset existed still gets a sensible
        // one inferred from its Amazon categories.
        adPreset:
          project.adPreset ||
          inferPreset({ categories: project.categories, title: project.title }).key,
        adHeadline: project.adHeadline,
        adBenefits: project.adBenefits,
        aiScene: project.aiScene,
        showProof: project.showProof,
      }}
      book={{
        title: project.title ?? '',
        author: project.author ?? '',
        blurb: project.blurb ?? '',
        coverUrl: project.frontCoverUrl,
        interiorImageUrls: project.interiorImageUrls ?? [],
      }}
    />
  )
}
