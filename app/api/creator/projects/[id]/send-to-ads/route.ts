import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { prisma } from '@/lib/db'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)

  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }

  try {
    // Extract any illustration image URLs from pages if present
    const interiorImages: string[] = []
    if (project.content && (project.content.type === 'children' || project.content.type === 'coloring')) {
      for (const page of project.content.pages) {
        if (page.generatedImageUrl) {
          interiorImages.push(page.generatedImageUrl)
        }
      }
    }

    const adsBook = await prisma.book.create({
      data: {
        publisherId,
        title: project.title || 'Untitled Generated Book',
        author: project.author || 'Author',
        blurb: project.promptConcept || 'Created with Publisher Toolkit Book Studio',
        frontCoverUrl: project.coverImageUrl || null,
        interiorImageUrls: interiorImages.slice(0, 5),
        contentGoal: 'all',
        platforms: ['AMAZON'],
        campaignName: `${project.title || 'Book'} - Launch Campaign`,
        campaignObjective: 'launch',
        copyTone: 'bold',
        templateKey: project.styleTheme === 'watercolor' ? 'parchment' : 'classic',
        ctaText: 'Order Your Copy Today',
      },
    })

    return NextResponse.json({
      adsProjectId: adsBook.id,
      redirectUrl: `/ads/${adsBook.id}/configure`,
    })
  } catch (err: any) {
    console.error('Failed to bridge book to ads:', err)
    return NextResponse.json({ error: err.message || 'Failed to bridge book to ads studio' }, { status: 500 })
  }
}
