import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLandingProjectBySlug } from '@/lib/services/landing/queries'
import { renderLandingPageHtml } from '@/lib/services/landing/renderer'
import type { LandingTemplateKey, LandingThemeKey } from '@/lib/services/landing/options'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = await getLandingProjectBySlug(slug)
  if (!project) return { title: 'Book Not Found' }

  return {
    title: `${project.title || 'Book'} by ${project.author || 'Author'}`,
    description: project.subtitle || project.synopsis?.slice(0, 160) || 'Official Book Website',
    openGraph: {
      title: `${project.title || 'Book'} by ${project.author || 'Author'}`,
      description: project.subtitle || project.synopsis?.slice(0, 160) || 'Official Book Website',
      images: project.coverUrl ? [project.coverUrl] : [],
    },
  }
}

export default async function PublicBookLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await getLandingProjectBySlug(slug)
  if (!project) notFound()

  const html = renderLandingPageHtml({
    title: project.title || 'Untitled Book',
    subtitle: project.subtitle,
    author: project.author || 'Author',
    authorBio: project.authorBio,
    synopsis: project.synopsis,
    coverUrl: project.coverUrl,
    template: (project.template as LandingTemplateKey) || 'bestseller',
    theme: (project.theme as LandingThemeKey) || 'matt',
    accentColor: project.accentColor || '#6366f1',
    ctaText: project.ctaText || 'Order Your Copy Today',
    retailerLinks: (project.retailerLinks as any) || null,
    reviews: (project.reviews as any) || null,
    sampleChapterTitle: project.sampleChapterTitle,
    sampleChapterText: project.sampleChapterText,
  })

  // Render direct standalone HTML with dangerouslySetInnerHTML in full html/body shell
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
