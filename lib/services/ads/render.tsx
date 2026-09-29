import { ImageResponse } from 'next/og'
import { CREATIVE_SIZES } from './sizes'
import { goalSizes } from './goal'
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
  contentGoal?: string | null
}): Promise<RenderedCreativeImage[]> {
  const { palette } = getTemplate(input.templateKey ?? 'classic')
  const sizes = goalSizes(
    input.contentGoal,
    input.platforms?.length ? input.platforms : CREATIVE_SIZES.map((s) => s.platform)
  )

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
