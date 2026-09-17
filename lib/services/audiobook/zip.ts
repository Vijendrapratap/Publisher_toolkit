import JSZip from 'jszip'
import { readStoredFile } from '@/lib/providers/storage'

export interface AudiobookZipInput {
  title: string
  author?: string | null
  ttsProvider: string
  voiceModel: string
  audioFormat: string
  coverUrl?: string | null
  fullAudioUrl?: string | null
  chapters: {
    chapterNumber: number
    title: string
    audioUrl?: string | null
    duration: number
  }[]
}

export function audiobookZipFileName(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'audiobook'
  return `${slug}-complete-audiobook.zip`
}

export async function buildAudiobookZip(
  input: AudiobookZipInput,
  read: typeof readStoredFile = readStoredFile
): Promise<Buffer> {
  const zip = new JSZip()
  const m3uEntries: string[] = ['#EXTM3U']

  // 1. Chapters audio tracks
  for (const ch of input.chapters) {
    if (!ch.audioUrl) continue
    const padded = String(ch.chapterNumber).padStart(2, '0')
    const safeTitle = ch.title.replace(/[^a-z0-9\-_ ]/gi, '').trim() || `Chapter ${ch.chapterNumber}`
    const fileName = `chapters/${padded}-${safeTitle}.${input.audioFormat}`

    try {
      const stored = await read(ch.audioUrl)
      zip.file(fileName, stored.data)
      m3uEntries.push(`#EXTINF:${ch.duration},${input.author ? `${input.author} - ` : ''}${ch.title}`)
      m3uEntries.push(fileName)
    } catch {
      // Ignore read failures
    }
  }

  // 2. Full combined audiobook if available
  if (input.fullAudioUrl) {
    try {
      const full = await read(input.fullAudioUrl)
      zip.file(`full-audiobook.${input.audioFormat}`, full.data)
    } catch {
      // Ignore
    }
  }

  // 3. Album Art cover image
  if (input.coverUrl) {
    try {
      const cover = await read(input.coverUrl)
      const ext = cover.contentType.includes('png') ? 'png' : 'jpg'
      zip.file(`cover.${ext}`, cover.data)
    } catch {
      // Ignore
    }
  }

  // 4. M3U playlist
  zip.file('playlist.m3u', m3uEntries.join('\n'))

  // 5. Tracklist & metadata
  const metadataText = [
    `${input.title || 'Untitled Book'} — Complete Audiobook`,
    '='.repeat(60),
    `Author: ${input.author || 'Unknown'}`,
    `Narrator Engine: ${input.ttsProvider}`,
    `Voice Model: ${input.voiceModel}`,
    `Audio Format: ${input.audioFormat.toUpperCase()}`,
    `Chapters: ${input.chapters.length}`,
    '',
    'Tracklist:',
    ...input.chapters.map(
      (c) =>
        `- Track ${String(c.chapterNumber).padStart(2, '0')}: ${c.title} (${Math.floor(c.duration / 60)}m ${c.duration % 60}s)`
    ),
  ].join('\n')

  zip.file('tracklist.txt', metadataText)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
