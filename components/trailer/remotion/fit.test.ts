import { describe, it, expect } from 'vitest'
import { fitFontSize } from './fit'

describe('fitFontSize', () => {
  it('keeps the base size for text that fits comfortably', () => {
    expect(fitFontSize(72, 'short', 20)).toBe(72)
  })
  it('shrinks long text by the square root of the overflow', () => {
    expect(fitFontSize(100, 'x'.repeat(40), 20)).toBe(71)
  })
  it('never shrinks below the floor', () => {
    expect(fitFontSize(72, 'x'.repeat(80), 20)).toBe(40)
  })
})
