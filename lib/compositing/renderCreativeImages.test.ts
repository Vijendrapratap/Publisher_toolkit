import { describe, it, expect } from 'vitest'
import { renderCreativeImages } from './renderCreativeImages'
import { CREATIVE_SIZES } from '@/lib/templates/specs'
import { readPngSize } from './pngSize'

describe('renderCreativeImages', () => {
  it('renders one PNG per creative size at the correct dimensions', async () => {
    const images = await renderCreativeImages({
      coverImageUrl: 'https://example.com/cover.png',
      title: 'The Lazy Developer',
      author: 'Jane Coder',
    })

    expect(images).toHaveLength(CREATIVE_SIZES.length)
    for (const spec of CREATIVE_SIZES) {
      const image = images.find((i) => i.sizeKey === spec.key)
      expect(image).toBeDefined()
      const { width, height } = readPngSize(image!.pngBuffer)
      expect(width).toBe(spec.width)
      expect(height).toBe(spec.height)
    }
  })
})
