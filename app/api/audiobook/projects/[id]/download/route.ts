import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { buildAudiobookZip, audiobookZipFileName } from '@/lib/services/audiobook/zip'
import { readStoredFile } from '@/lib/providers/storage'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get('chapterId')

  // If a single chapter download is requested:
  if (chapterId) {
    const chapter = project.chapters.find((c) => c.id === chapterId)
    if (!chapter || !chapter.audioUrl) {
      return NextResponse.json({ error: 'Chapter audio not found' }, { status: 404 })
    }
    const stored = await readStoredFile(chapter.audioUrl)
    const ext = project.audioFormat || 'mp3'
    const fileName = `Chapter-${chapter.chapterNumber}-${chapter.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`

    return new NextResponse(stored.data as any, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType || 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  }

  // Complete audiobook ZIP package:
  const zipBuffer = await buildAudiobookZip({
    title: project.title || 'Untitled Book',
    author: project.author,
    ttsProvider: project.ttsProvider,
    voiceModel: project.voiceModel,
    audioFormat: project.audioFormat,
    coverUrl: project.coverUrl,
    fullAudioUrl: project.fullAudioUrl,
    chapters: project.chapters.map((c) => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      audioUrl: c.audioUrl,
      duration: c.duration,
    })),
  })

  const filename = audiobookZipFileName(project.title || 'audiobook')

  return new NextResponse(zipBuffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
