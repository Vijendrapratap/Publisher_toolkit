import { describe, it, expect } from 'vitest'
import { BOOK_RATIO, stageLayout, transitionFor, textSizeFor } from './layout'

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('stageLayout', () => {
  for (const [w, h] of [[1920, 1080], [1080, 1080], [1080, 1920]]) {
    for (const side of ['left', 'right'] as const) {
      it(`keeps text clear of the book at ${w}×${h}, text ${side}`, () => {
        const { book, text } = stageLayout(w, h, side)
        expect(overlap(book, text)).toBe(false)
        for (const box of [book, text]) {
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.y).toBeGreaterThanOrEqual(0)
          expect(box.x + box.w).toBeLessThanOrEqual(w)
          expect(box.y + box.h).toBeLessThanOrEqual(h)
        }
        expect(book.w / book.h).toBeCloseTo(BOOK_RATIO)
        expect(text.w).toBeGreaterThan(w * 0.3)
      })
    }
  }
})

describe('transitionFor', () => {
  it('slides into pages and fades into title and end cards', () => {
    expect(transitionFor('hook', 'pageZoom')).toBe('slide')
    expect(transitionFor('pageZoom', 'titleCard')).toBe('fade')
    expect(transitionFor('audience', 'endCard')).toBe('fade')
    expect(transitionFor('hook', 'audience')).toBe('wipe')
  })
})

describe('textSizeFor', () => {
  it('scales with the short side of the frame', () => {
    expect(textSizeFor(1920, 1080)).toBe(textSizeFor(1080, 1920))
    expect(textSizeFor(1920, 1080)).toBeGreaterThan(60)
  })
})
