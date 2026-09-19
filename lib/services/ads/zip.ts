import JSZip from 'jszip'
import { readStoredFile } from '@/lib/providers/storage'

type ZipInput = {
  title: string
  images: { platform: string; sizeKey: string; imageUrl: string }[]
  copies: { platform: string; headline: string; primaryText: string; description: string }[]
  videoUrl?: string | null
  videoPosterUrl?: string | null
}

export function zipFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
  return `${slug}-ad-creatives.zip`
}

export async function buildCreativeZip(input: ZipInput, read: typeof readStoredFile = readStoredFile): Promise<Buffer> {
  const zip = new JSZip()

  for (const image of input.images) {
    try {
      const { data } = await read(image.imageUrl)
      zip.file(`${image.platform.toLowerCase()}/${image.sizeKey}.png`, data)
    } catch (e) {
      console.warn(`Failed to add ${image.imageUrl} to zip:`, e)
    }
  }

  if (input.videoUrl) {
    try {
      const { data } = await read(input.videoUrl)
      zip.file('amazon/video-trailer.mp4', data)
    } catch (e) {
      console.warn('Failed to add video to zip:', e)
    }
  }

  if (input.videoPosterUrl) {
    try {
      const { data } = await read(input.videoPosterUrl)
      zip.file('amazon/video-poster.png', data)
    } catch (e) {
      console.warn('Failed to add video poster to zip:', e)
    }
  }

  const copyText = [
    `${input.title || 'Untitled book'} — Amazon Ad & A+ Content Copy`,
    '='.repeat(50),
    '',
    ...input.copies.flatMap((c) => [
      `[${c.platform}]`,
      `Headline: ${c.headline}`,
      `Primary text: ${c.primaryText}`,
      `Description: ${c.description}`,
      '',
    ]),
  ].join('\n')
  zip.file('copy.txt', copyText)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
