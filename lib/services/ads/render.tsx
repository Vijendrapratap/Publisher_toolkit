import { ImageResponse } from 'next/og'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { CreativeTemplate } from '@/lib/services/ads/CreativeTemplate'
import type { AdPlatform } from '@/lib/services/ads/copy'

export interface RenderedCreativeImage {
  sizeKey: string
  platform: AdPlatform
  width: number
  height: number
  pngBuffer: Buffer
}

export async function renderCreativeImages(input: {
  coverImageUrl: string
  title: string
  author: string
}): Promise<RenderedCreativeImage[]> {
  const results: RenderedCreativeImage[] = []

  for (const spec of CREATIVE_SIZES) {
    const response = new ImageResponse(
      (
        <CreativeTemplate
          coverImageUrl={input.coverImageUrl}
          title={input.title}
          author={input.author}
          width={spec.width}
          height={spec.height}
        />
      ),
      { width: spec.width, height: spec.height }
    )
    const arrayBuffer = await response.arrayBuffer()
    results.push({
      sizeKey: spec.key,
      platform: spec.platform,
      width: spec.width,
      height: spec.height,
      pngBuffer: Buffer.from(arrayBuffer),
    })
  }

  return results
}
