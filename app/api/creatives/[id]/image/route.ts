import { prisma } from '@/lib/db'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { readStoredFile } from '@/lib/providers/storage'

const notFound = () => Response.json({ error: 'Not found' }, { status: 404 })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()

  // Scoped through the creative set to the owning book: a creative id alone
  // must not be enough to read another publisher's artwork.
  const image = await prisma.creativeImage.findFirst({
    where: { id, creativeSet: { book: { publisherId } } },
    select: { imageUrl: true, sizeKey: true },
  })
  if (!image) return notFound()

  try {
    const file = await readStoredFile(image.imageUrl)
    const headers: Record<string, string> = {
      'Content-Type': file.contentType,
      // Private: the URL is per-publisher, so shared caches must not hold it.
      'Cache-Control': 'private, max-age=86400',
    }
    if (new URL(request.url).searchParams.get('download') === '1') {
      headers['Content-Disposition'] = `attachment; filename="${image.sizeKey}.png"`
    }
    return new Response(new Uint8Array(file.data), { headers })
  } catch (err) {
    console.error('Failed to serve creative image', id, err)
    return Response.json({ error: 'Failed to read image' }, { status: 500 })
  }
}
