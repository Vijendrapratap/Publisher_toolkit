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
  campaignBadge?: string
  ctaText?: string
}): Promise<RenderedCreativeImage[]> {
  const { palette } = getTemplate(input.templateKey ?? 'classic')
  const sizes = input.platforms?.length
    ? CREATIVE_SIZES.filter((s) => input.platforms!.includes(s.platform))
    : CREATIVE_SIZES

  // Each size is an independent rasterisation — awaiting them one at a time
  // made a nine-size campaign take nine times as long as it needed to.
  return Promise.all(
    sizes.map(async (spec) => {
      const response = new ImageResponse(
        (
          <CreativeTemplate
            coverImageUrl={input.coverImageUrl}
            title={input.title}
            author={input.author}
            width={spec.width}
            height={spec.height}
            palette={palette}
            campaignBadge={input.campaignBadge}
            ctaText={input.ctaText}
          />
        ),
        { width: spec.width, height: spec.height }
      )
      return {
        sizeKey: spec.key,
        platform: spec.platform,
        width: spec.width,
        height: spec.height,
        pngBuffer: Buffer.from(await response.arrayBuffer()),
      }
    })
  )
}
