import { describe, it, expect } from 'vitest'
import { extractBookAssets } from './extract'
import { buildFixturePdf } from './testFixtures'

describe('extractBookAssets', () => {
  it('extracts title/author text and renders front/back cover images', async () => {
    const pdf = await buildFixturePdf()
    const result = await extractBookAssets(pdf)

    expect(result.title).toContain('The Lazy Developer')
    expect(result.frontCoverPng).not.toBeNull()
    expect(result.backCoverPng).not.toBeNull()
    // PNG signature check — first 8 bytes identify a valid PNG.
    expect(result.frontCoverPng!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('returns nulls instead of throwing for an empty/invalid PDF', async () => {
    const result = await extractBookAssets(Buffer.from('not a pdf'))
    expect(result.title).toBeNull()
    expect(result.frontCoverPng).toBeNull()
  })
})
