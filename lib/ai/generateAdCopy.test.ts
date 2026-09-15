import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

import { generateText } from 'ai'
import { generateAdCopy } from './generateAdCopy'

const book = { title: 'The Lazy Developer', author: 'Jane Coder', blurb: 'A story about shipping less code.' }

describe('generateAdCopy', () => {
  it('returns copy for each platform on success', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        variants: [
          { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
          { platform: 'GOOGLE', headline: 'H2', primaryText: 'P2', description: 'D2' },
          { platform: 'AMAZON', headline: 'H3', primaryText: 'P3', description: 'D3' },
        ],
      },
    } as any)

    const result = await generateAdCopy(book)
    expect(result).toHaveLength(3)
    expect(result[0].platform).toBe('META')
  })

  it('retries once and returns [] if generation keeps failing', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('rate limited'))

    const result = await generateAdCopy(book)
    expect(result).toEqual([])
    expect(generateText).toHaveBeenCalledTimes(2)
  })
})
