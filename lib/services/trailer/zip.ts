import JSZip from 'jszip'
import { readStoredFile } from '@/lib/providers/storage'

export interface TrailerZipInput {
  title: string
  author?: string | null
  blurb?: string | null
  length: string
  style: string
  musicMood: string
  trailers: {
    aspectRatio: string
    videoUrl: string
    posterUrl: string
  }[]
}

export function zipFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
  return `${slug}-trailer-videos.zip`
}

export async function buildTrailerZip(
  input: TrailerZipInput,
  read: typeof readStoredFile = readStoredFile
): Promise<Buffer> {
  const zip = new JSZip()

  for (const trailer of input.trailers) {
    const aspectSlug = trailer.aspectRatio.replace(':', 'x')
    try {
      const video = await read(trailer.videoUrl)
      zip.file(`trailers/trailer-${aspectSlug}.mp4`, video.data)
    } catch {
      // Ignore if video reading fails
    }

    try {
      const poster = await read(trailer.posterUrl)
      const ext = poster.contentType.includes('png') ? 'png' : 'jpg'
      zip.file(`posters/poster-${aspectSlug}.${ext}`, poster.data)
    } catch {
      // Ignore if poster reading fails
    }
  }

  const detailsText = [
    `${input.title || 'Untitled Book'} — Book Trailer Package`,
    '='.repeat(50),
    `Author: ${input.author || 'Unknown'}`,
    `Length: ${input.length}`,
    `Style: ${input.style}`,
    `Music Mood: ${input.musicMood}`,
    '',
    'Blurb / Synopsis:',
    input.blurb || '(None provided)',
    '',
    'Generated Files:',
    ...input.trailers.map((t) => `- Aspect ratio ${t.aspectRatio}: trailers/trailer-${t.aspectRatio.replace(':', 'x')}.mp4`),
  ].join('\n')

  zip.file('trailer-details.txt', detailsText)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
