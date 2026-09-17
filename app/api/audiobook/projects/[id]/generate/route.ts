import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { synthesizeChapterAudio, concatenateChapters } from '@/lib/services/audiobook/tts'
import { storeFile } from '@/lib/providers/storage'
import type { AudioFormatKey, TtsEngineKey } from '@/lib/services/audiobook/options'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (project.chapters.length === 0) {
    return NextResponse.json({ error: 'Audiobook project has no chapters to synthesize' }, { status: 400 })
  }

  const format = (project.audioFormat as AudioFormatKey) || 'mp3'
  const ttsProvider = (project.ttsProvider as TtsEngineKey) || 'fishaudio'
  const voiceModel = project.voiceModel || 'warm-literary'
  const voicePacing = project.voicePacing || 1.0

  try {
    const chapterBuffers: Buffer[] = []
    let totalDurationSec = 0

    // Synthesize each chapter sequentially
    for (const ch of project.chapters) {
      const synthesized = await synthesizeChapterAudio({
        text: ch.content,
        chapterTitle: ch.title,
        ttsProvider,
        voiceModel,
        voicePacing,
        audioFormat: format,
        sampleAudioUrl: project.sampleAudioUrl,
      })

      chapterBuffers.push(synthesized.audioBuffer)
      totalDurationSec += synthesized.durationSec

      const storedAudio = await storeFile(
        `audiobook/${publisherId}/${project.id}/chapter-${ch.chapterNumber}.${format}`,
        synthesized.audioBuffer,
        synthesized.mimeType
      )

      await prisma.audiobookChapter.update({
        where: { id: ch.id },
        data: {
          audioUrl: storedAudio.url,
          duration: synthesized.durationSec,
          status: 'ready',
        },
      })
    }

    // Generate combined full audiobook track
    let fullAudioUrl: string | null = null
    if (chapterBuffers.length > 0) {
      const fullBuffer = await concatenateChapters(chapterBuffers, format)
      const storedFull = await storeFile(
        `audiobook/${publisherId}/${project.id}/complete-audiobook.${format}`,
        fullBuffer,
        format === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      )
      fullAudioUrl = storedFull.url
    }

    await prisma.audiobookProject.update({
      where: { id: project.id },
      data: {
        status: 'generated',
        totalDuration: totalDurationSec,
        fullAudioUrl,
      },
    })

    return NextResponse.json(
      {
        success: true,
        chaptersCount: project.chapters.length,
        totalDuration: totalDurationSec,
        fullAudioUrl,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Audiobook synthesis failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audiobook synthesis encountered an error' },
      { status: 500 }
    )
  }
}
