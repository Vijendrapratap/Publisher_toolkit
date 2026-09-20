import { describe, it, expect } from 'vitest'
import {
  beatAt,
  beatOpacity,
  easeOut,
  fitSingleLine,
  fitText,
  isLegible,
  minLegiblePx,
  planBeats,
  safeFontWeight,
  stagger,
  typeRamp,
  wrapLines,
  MIN_BEAT_SEC,
} from './layout'
import type { BeatKind } from './presets'

/** Stand-in metric: every glyph is 0.6em wide. */
const measure = (size: number, s: string) => s.length * size * 0.6

describe('safeFontWeight', () => {
  it('snaps to the ladder skia actually supports', () => {
    // 750 is accepted by ctx.font but returns metrics ~50x too large, which
    // painted benefit text across the whole canvas.
    expect(safeFontWeight(750)).toBe(800)
    expect(safeFontWeight(650)).toBe(700)
    expect(safeFontWeight(450)).toBe(500)
  })

  it('leaves valid weights alone and clamps out-of-range ones', () => {
    expect(safeFontWeight(800)).toBe(800)
    expect(safeFontWeight(0)).toBe(100)
    expect(safeFontWeight(1200)).toBe(900)
  })
})

describe('type ramp', () => {
  it('keeps every size legible once scaled into an Amazon tile', () => {
    const ramp = typeRamp(1080, 300)
    for (const size of [ramp.headline, ramp.benefit, ramp.label, ramp.caption]) {
      expect(isLegible(size, 1080, 300)).toBe(true)
    }
  })

  it('scales up when the tile is a smaller fraction of the canvas', () => {
    expect(typeRamp(1920, 300).headline).toBeGreaterThan(typeRamp(1080, 300).headline)
  })

  it('never returns a size below the legibility floor', () => {
    const ramp = typeRamp(1080, 300)
    expect(ramp.label).toBeGreaterThanOrEqual(minLegiblePx(1080, 300))
  })
})

describe('wrapLines', () => {
  it('breaks on width and keeps every word', () => {
    const lines = wrapLines('EXTRA LARGE PRINT EDITION', 100, (s) => measure(10, s))
    expect(lines.join(' ')).toBe('EXTRA LARGE PRINT EDITION')
    expect(lines.length).toBeGreaterThan(1)
  })
})

describe('fitText', () => {
  it('shrinks an unbreakable word until it fits the column', () => {
    // A single long word cannot wrap, so a height-only check accepted it at
    // full size and painted it across the cover beside it.
    const box = { width: 120, height: 400 }
    const fitted = fitText('SOLUTIONS', box, 60, 10, measure)

    expect(measure(fitted.size, 'SOLUTIONS')).toBeLessThanOrEqual(box.width)
  })

  it('keeps the largest size that fits both axes', () => {
    const fitted = fitText('SHORT', { width: 1000, height: 1000 }, 60, 10, measure)
    expect(fitted.size).toBe(60)
  })

  it('stops at the floor rather than shrinking indefinitely', () => {
    expect(fitText('X'.repeat(200), { width: 10, height: 10 }, 60, 12, measure).size).toBe(12)
  })
})

describe('fitSingleLine', () => {
  it('shrinks rather than dropping the end of a claim', () => {
    const fitted = fitSingleLine('100 INTERESTING THEMES', 300, 60, 20, measure)
    expect(fitted.text).toBe('100 INTERESTING THEMES')
    expect(measure(fitted.size, fitted.text)).toBeLessThanOrEqual(300)
  })

  it('marks a genuinely impossible line with an ellipsis', () => {
    const fitted = fitSingleLine('A'.repeat(200), 100, 60, 40, measure)
    expect(fitted.text.endsWith('…')).toBe(true)
    expect(measure(fitted.size, fitted.text)).toBeLessThanOrEqual(100)
  })
})

describe('planBeats', () => {
  const all: BeatKind[] = ['hook', 'benefits', 'interior', 'cta']
  const available = new Set<BeatKind>(all)

  it('fills exactly the requested duration', () => {
    const beats = planBeats(all, 15, available)
    const total = beats.reduce((sum, b) => sum + b.durationSec, 0)
    expect(total).toBeCloseTo(15, 5)
    expect(beats[0].startSec).toBe(0)
  })

  it('drops optional beats so the survivors can still land', () => {
    const beats = planBeats(all, 6, available)
    expect(beats.every((b) => b.durationSec >= MIN_BEAT_SEC)).toBe(true)
    expect(beats.map((b) => b.kind)).toContain('hook')
    expect(beats.map((b) => b.kind)).toContain('cta')
  })

  it('never drops the hook or the call to action', () => {
    const beats = planBeats(all, 2, available)
    expect(beats.map((b) => b.kind)).toEqual(['hook', 'cta'])
  })

  it('skips beats whose assets are missing', () => {
    const beats = planBeats(all, 20, new Set<BeatKind>(['hook', 'benefits', 'cta']))
    expect(beats.map((b) => b.kind)).not.toContain('interior')
  })

  it('gives the hook the largest share, since most views never reach beat two', () => {
    const beats = planBeats(all, 20, available)
    const hook = beats.find((b) => b.kind === 'hook')!
    const cta = beats.find((b) => b.kind === 'cta')!
    expect(hook.durationSec).toBeGreaterThan(cta.durationSec)
  })
})

describe('beatAt', () => {
  const beats = planBeats(['hook', 'benefits', 'cta'], 15, new Set<BeatKind>(['hook', 'benefits', 'cta']))

  it('reports the beat covering a moment and its local progress', () => {
    expect(beatAt(beats, 0).beat.kind).toBe('hook')
    expect(beatAt(beats, 0).progress).toBe(0)
    expect(beatAt(beats, 14.999).beat.kind).toBe('cta')
  })

  it('clamps past the end instead of running off the plan', () => {
    const { beat, progress } = beatAt(beats, 999)
    expect(beat.kind).toBe('cta')
    expect(progress).toBe(1)
  })
})

describe('motion helpers', () => {
  it('eases out within bounds', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })

  it('holds a beat fully opaque through its middle', () => {
    expect(beatOpacity(0)).toBe(0)
    expect(beatOpacity(0.5)).toBe(1)
    expect(beatOpacity(1)).toBeCloseTo(0, 5)
  })

  it('staggers a list so later items arrive later', () => {
    const reveals = stagger(0.3, 3)
    expect(reveals[0]).toBeGreaterThan(reveals[1])
    expect(reveals[1]).toBeGreaterThan(reveals[2])
  })
})
