import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { storeFile } from '@/lib/providers/storage'
import { assetPath } from '@/lib/services/shared/upload'

const MAX_BYTES = 15 * 1024 * 1024
// Browsers report the same formats under several names.
const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const file = (await request.formData().catch(() => null))?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 })
  }
  const type = AUDIO_TYPES[file.type]
  if (!type) return NextResponse.json({ error: 'Use an MP3, WAV or M4A file.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Music files can be up to 15 MB.' }, { status: 400 })

  const { url } = await storeFile(assetPath('ads/music', publisherId, 'track', type), Buffer.from(await file.arrayBuffer()), type)
  return NextResponse.json({ url, name: file.name.slice(0, 120) }, { status: 201 })
}
