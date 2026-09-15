import { ImageResponse } from 'next/og'
import { CREATIVE_SIZES } from './sizes'
import { CreativeTemplate } from './CreativeTemplate'
import { getTemplate } from './options'
import type { AdPlatform } from './copy'

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
  templateKey?: string
  platforms?: AdPlatform[]
}): Promise<RenderedCreativeImage[]> {
  const { palette } = getTemplate(input.templateKey ?? 'classic')
  const sizes = input.platforms?.length
    ? CREATIVE_SIZES.filter((s) => input.platforms!.includes(s.platform))
    : CREATIVE_SIZES

  const results: RenderedCreativeImage[] = []
  for (const spec of sizes) {
    const response = new ImageResponse(
      (
        <CreativeTemplate
          coverImageUrl={input.coverImageUrl}
          title={input.title}
          author={input.author}
          width={spec.width}
          height={spec.height}
          palette={palette}
        />
      ),
      { width: spec.width, height: spec.height }
    )
    results.push({
      sizeKey: spec.key,
      platform: spec.platform,
      width: spec.width,
      height: spec.height,
      pngBuffer: Buffer.from(await response.arrayBuffer()),
    })
  }
  return results
}
