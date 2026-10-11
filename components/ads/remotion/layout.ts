import type { BeatKind } from '@/lib/services/ads/storyboard'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Width ÷ height of a typical book cover. */
export const BOOK_RATIO = 0.68

/** Where the book and the line sit when the text is on `side`; they never overlap. */
export function stageLayout(width: number, height: number, side: 'left' | 'right'): { book: Box; text: Box; stacked: boolean } {
  if (height > width) {
    const h = height * 0.4
    const w = h * BOOK_RATIO
    return {
      stacked: true,
      book: { x: (width - w) / 2, y: height * 0.1, w, h },
      text: { x: width * 0.08, y: height * 0.56, w: width * 0.84, h: height * 0.32 },
    }
  }
  const h = height * (width === height ? 0.56 : 0.66)
  const w = h * BOOK_RATIO
  const margin = width * 0.07
  const gap = width * 0.05
  const bookX = side === 'left' ? width - margin - w : margin
  const textX = side === 'left' ? margin : bookX + w + gap
  const textW = side === 'left' ? bookX - gap - margin : width - margin - textX
  return {
    stacked: false,
    book: { x: bookX, y: (height - h) / 2, w, h },
    text: { x: textX, y: height * 0.18, w: textW, h: height * 0.64 },
  }
}

export type TransitionKind = 'fade' | 'slide' | 'wipe'

export function transitionFor(_prev: BeatKind, next: BeatKind): TransitionKind {
  if (next === 'pageZoom' || next === 'bookOpen') return 'slide'
  if (next === 'titleCard' || next === 'endCard') return 'fade'
  return 'wipe'
}

/** Base size for a beat line; fitFontSize shrinks long lines from here. */
export const textSizeFor = (width: number, height: number) => Math.round(Math.min(width, height) * 0.092)
