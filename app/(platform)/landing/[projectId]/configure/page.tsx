import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { LandingConfigureForm } from '@/components/landing/LandingConfigureForm'
import type { LandingTemplateKey, LandingThemeKey } from '@/lib/services/landing/options'

export default async function LandingConfigureStepPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, projectId)
  if (!project) notFound()

  return (
    <LandingConfigureForm
      projectId={project.id}
      initial={{
        template: (project.template as LandingTemplateKey) || 'bestseller',
        theme: (project.theme as LandingThemeKey) || 'matt',
        accentColor: project.accentColor || '#6366f1',
        ctaText: project.ctaText || 'Order Your Copy Today',
        subtitle: project.subtitle,
        synopsis: project.synopsis,
        authorBio: project.authorBio,
        sampleChapterTitle: project.sampleChapterTitle,
        sampleChapterText: project.sampleChapterText,
        retailerLinks: (project.retailerLinks as any) || null,
        reviews: (project.reviews as any) || null,
      }}
      book={{
        title: project.title ?? '',
        author: project.author ?? '',
        coverUrl: project.coverUrl,
      }}
    />
  )
}
