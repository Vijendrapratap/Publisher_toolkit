import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { runAuthorLandingAgent, authorLandingAgentInputSchema } from '@/lib/services/landing/agent'
import { prisma } from '@/lib/db'

export const maxDuration = 120

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'Landing project not found' }, { status: 404 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parseResult = authorLandingAgentInputSchema.safeParse({
    bookTitle: body.bookTitle || project.title || 'Untitled Book',
    authorName: body.authorName || project.author || 'Author',
    authorPersona: body.authorPersona,
    authorVoice: body.authorVoice,
    authorQuote: body.authorQuote,
    primaryObjective: body.primaryObjective || 'preorder',
    targetAudience: body.targetAudience,
    readerMagnet: body.readerMagnet,
    otherWorks: body.otherWorks,
    accolades: body.accolades,
    templatePreference: body.templatePreference,
    themePreference: body.themePreference,
  })

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid agent parameters', details: parseResult.error.format() },
      { status: 400 }
    )
  }

  const generated = await runAuthorLandingAgent(parseResult.data)

  // Persist the synthesized output into the project record
  const updated = await prisma.landingProject.update({
    where: { id: project.id },
    data: {
      subtitle: generated.subtitle,
      authorBio: generated.authorBio,
      synopsis: generated.synopsis,
      ctaText: generated.ctaText,
      template: generated.recommendedTemplate,
      theme: generated.recommendedTheme,
      accentColor: generated.recommendedAccent,
      reviews: generated.reviews as any,
    },
  })

  return NextResponse.json(
    {
      success: true,
      agentResult: generated,
      project: updated,
    },
    { status: 200 }
  )
}
