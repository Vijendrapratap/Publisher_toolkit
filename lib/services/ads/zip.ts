import JSZip from 'jszip'
import { readStoredFile } from '@/lib/providers/storage'

type ZipInput = {
  title: string
  images: { platform: string; sizeKey: string; imageUrl: string }[]
  copies: { platform: string; headline: string; primaryText: string; description: string }[]
}

export function zipFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
  return `${slug}-ad-creatives.zip`
}

export async function buildCreativeZip(input: ZipInput, read: typeof readStoredFile = readStoredFile): Promise<Buffer> {
  const zip = new JSZip()

  for (const image of input.images) {
    const { data } = await read(image.imageUrl)
    zip.file(`${image.platform.toLowerCase()}/${image.sizeKey}.png`, data)
  }

  const copyText = [
    `${input.title || 'Untitled book'} — ad copy`,
    '',
    ...input.copies.flatMap((c) => [
      c.platform,
      `Headline: ${c.headline}`,
      `Primary text: ${c.primaryText}`,
      `Description: ${c.description}`,
      '',
    ]),
  ].join('\n')
  zip.file('copy.txt', copyText)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
