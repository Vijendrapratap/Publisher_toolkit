import { getLandingProjectBySlug } from '@/lib/services/landing/queries'
import { readStoredFile } from '@/lib/providers/storage'

/**
 * A published book site is public, but its cover lives under the publisher's
 * own storage prefix, which /api/files guards by publisher. Visitors were
 * therefore served a broken image. This route serves exactly the cover of a
 * project the publisher chose to publish, and nothing else.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getLandingProjectBySlug(slug)
  if (!project?.coverUrl) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const file = await readStoredFile(project.coverUrl)
    return new Response(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('Failed to serve landing cover', slug, err)
    return Response.json({ error: 'Failed to read cover' }, { status: 500 })
  }
}
