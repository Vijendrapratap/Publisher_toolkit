import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { renderLandingPageHtml } from '@/lib/services/landing/renderer'
import type { LandingTemplateKey, LandingThemeKey } from '@/lib/services/landing/options'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

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

  const filename = `${(project.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'author'}-landing.html`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
