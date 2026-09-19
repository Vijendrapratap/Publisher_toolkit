import { prisma } from '@/lib/db'
import { readStoredFile } from '@/lib/providers/storage'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const isDownload = url.searchParams.get('download') === '1'

  const image = await prisma.creativeImage.findUnique({
    where: { id },
    select: { imageUrl: true, sizeKey: true, platform: true },
  })

  if (!image) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const file = await readStoredFile(image.imageUrl)
    const headers: Record<string, string> = {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    }
    if (isDownload) {
      headers['Content-Disposition'] = `attachment; filename="${image.sizeKey}.png"`
    }
    return new Response(new Uint8Array(file.data), { headers })
  } catch (err) {
    console.error('Failed to serve creative image', id, err)
    return new Response('Failed to read image', { status: 500 })
  }
}
