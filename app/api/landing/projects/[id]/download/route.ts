import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { buildLandingZip, landingZipFileName } from '@/lib/services/landing/zip'
import type { LandingTemplateKey, LandingThemeKey } from '@/lib/services/landing/options'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const zipBuffer = await buildLandingZip({
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
    publishedSlug: project.publishedSlug,
  })

  const filename = landingZipFileName(project.title || 'website')

  return new NextResponse(zipBuffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
