import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { synthesizeChapterAudio, concatenateChapters } from '@/lib/services/audiobook/tts'
import { storeFile } from '@/lib/providers/storage'
import type { AudioFormatKey, TtsEngineKey } from '@/lib/services/audiobook/options'
import { prisma } from '@/lib/db'

export const maxDuration = 300

// Bounded so a long book does not fan out into a rate limit.
const TTS_CONCURRENCY = 4

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
    // Chapters are independent. They render in parallel but in bounded batches,
    // because a 40-chapter book firing 40 concurrent TTS requests gets rate
    // limited, and every provider here charges per call.
    const rendered: { id: string; buffer: Buffer; url: string; durationSec: number }[] = []

    for (let i = 0; i < project.chapters.length; i += TTS_CONCURRENCY) {
      const batch = project.chapters.slice(i, i + TTS_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (ch) => {
          const synthesized = await synthesizeChapterAudio({
            text: ch.content,
            chapterTitle: ch.title,
            ttsProvider,
            voiceModel,
            voicePacing,
            audioFormat: format,
            sampleAudioUrl: project.sampleAudioUrl,
          })
          const stored = await storeFile(
            `audiobook/${publisherId}/${project.id}/chapter-${ch.chapterNumber}.${format}`,
            synthesized.audioBuffer,
            synthesized.mimeType
          )
          return {
            id: ch.id,
            buffer: synthesized.audioBuffer,
            url: stored.url,
            durationSec: synthesized.durationSec,
          }
        })
      )
      rendered.push(...results)
    }

    // One round-trip instead of one per chapter.
    await prisma.$transaction(
      rendered.map((r) =>
        prisma.audiobookChapter.update({
          where: { id: r.id },
          data: { audioUrl: r.url, duration: r.durationSec, status: 'ready' },
        })
      )
    )

    const chapterBuffers = rendered.map((r) => r.buffer)
    const totalDurationSec = rendered.reduce((sum, r) => sum + r.durationSec, 0)

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
