import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

import { generateText } from 'ai'
import { generateAdCopy } from './copy'

const book = { title: 'The Lazy Developer', author: 'Jane Coder', blurb: 'A story about shipping less code.' }

describe('generateAdCopy', () => {
  beforeEach(() => { process.env.AI_GATEWAY_API_KEY = 'test-key' })
  afterEach(() => { delete process.env.AI_GATEWAY_API_KEY; vi.mocked(generateText).mockReset() })

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

  it('uses local sample copy without calling the model when AI is not configured', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    const result = await generateAdCopy(book)
    expect(result).toHaveLength(3)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('includes the tone in the prompt and keeps only requested platforms', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        variants: [
          { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
          { platform: 'GOOGLE', headline: 'H2', primaryText: 'P2', description: 'D2' },
          { platform: 'AMAZON', headline: 'H3', primaryText: 'P3', description: 'D3' },
        ],
      },
    } as any)

    const result = await generateAdCopy(book, { tone: 'punchy', platforms: ['GOOGLE'] })

    expect(result.map((r) => r.platform)).toEqual(['GOOGLE'])
    expect(vi.mocked(generateText).mock.calls[0][0].prompt).toContain('Tone: punchy')
  })

  it('filters local sample copy to the requested platforms too', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    const result = await generateAdCopy(book, { tone: 'bold', platforms: ['META', 'AMAZON'] })
    expect(result.map((r) => r.platform)).toEqual(['META', 'AMAZON'])
  })
})
