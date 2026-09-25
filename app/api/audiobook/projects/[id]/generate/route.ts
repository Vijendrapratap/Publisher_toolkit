import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { synthesizeChapterAudio, concatenateChapters, estimateDuration } from '@/lib/services/audiobook/tts'
import { storeFile } from '@/lib/providers/storage'
import type { AudioFormatKey, TtsEngineKey } from '@/lib/services/audiobook/options'
import { prisma } from '@/lib/db'
import { chargeCredits, creditErrorResponse } from '@/lib/credits/charge'

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

  // Priced per 10 minutes of narration, estimated from the text up front so the
  // charge reflects what is about to be synthesized, not what a slow TTS call returns.
  const totalEstimatedSec = project.chapters.reduce(
    (sum, ch) => sum + estimateDuration(ch.content, voicePacing),
    0
  )
  const units = Math.max(1, Math.ceil(totalEstimatedSec / 600))

  try {
    const payload = await chargeCredits(
      { userId: publisherId, action: 'audiobook.tts', units, refId: project.id },
      async () => {
      // Chapters are independent. They render in parallel but in bounded batches,
      // because a 40-chapter book firing 40 concurrent TTS requests gets rate
      // limited, and every provider here charges per call.
      const rendered: { id: string; buffer: Buffer; url: string; durationSec: number; source: 'ai' | 'fallback' }[] = []

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
              source: synthesized.source,
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
      // Fallback narration (no key / provider failure / 'standard' engine) is
      // free: only real narration is billed, per second actually narrated.
      const aiDurationSec = rendered
        .filter((r) => r.source === 'ai')
        .reduce((sum, r) => sum + r.durationSec, 0)
      const usedUnits = aiDurationSec === 0 ? 0 : Math.max(1, Math.ceil(aiDurationSec / 600))

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

        return {
          result: {
            success: true,
            chaptersCount: project.chapters.length,
            totalDuration: totalDurationSec,
            fullAudioUrl,
          },
          usedUnits,
        }
      }
    )
    return NextResponse.json(payload, { status: 201 })
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    console.error('Audiobook synthesis failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audiobook synthesis encountered an error' },
      { status: 500 }
    )
  }
}
