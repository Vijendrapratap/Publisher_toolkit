import { readFile } from 'node:fs/promises'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { contentTypeFor, resolveLocalPath } from '@/lib/providers/storage'

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  const publisherId = await requireCurrentPublisherId()
  if (segments.length < 3 || segments[1] !== publisherId) return notFound()

  const pathname = segments.join('/')
  let data: Buffer
  try {
    data = await readFile(resolveLocalPath(pathname))
  } catch {
    return notFound()
  }
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': contentTypeFor(pathname), 'Cache-Control': 'private, max-age=3600' },
  })
}
