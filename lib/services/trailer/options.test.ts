import { describe, it, expect } from 'vitest'
import {
  toTrailerLength,
  LENGTH_OPTIONS,
  STYLE_OPTIONS,
  MUSIC_MOOD_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  getAspectRatioSpec,
  getDurationForLength,
  trailerProjectUpdateSchema,
} from './options'

describe('trailer options', () => {
  it('offers the Amazon-appropriate durations, not the old YouTube ones', () => {
    // 60s was a book-trailer length. Sponsored Brands accepts 6-45s and these
    // ads are watched in a carousel tile, so the ladder now tops out at 30s.
    expect(LENGTH_OPTIONS.map((l) => l.key)).toEqual(['6s', '15s', '20s', '30s'])
    expect(getDurationForLength('6s')).toBe(6)
    expect(getDurationForLength('15s')).toBe(15)
    expect(getDurationForLength('20s')).toBe(20)
    expect(getDurationForLength('30s')).toBe(30)
  })

  it('falls back to the recommended length for an unknown value', () => {
    expect(getDurationForLength('unknown')).toBe(30)
    expect(toTrailerLength('60s')).toBe('15s')
  })

  it('defines 8 visual genre styles with palettes and metadata', () => {
    expect(STYLE_OPTIONS.map((s) => s.key)).toEqual([
      'fantasy',
      'thriller',
      'scifi',
      'romance',
      'cinematic',
      'minimal',
      'dramatic',
      'energetic',
    ])
    for (const s of STYLE_OPTIONS) {
      expect(s.palette.background).toBeTruthy()
      expect(s.palette.accent).toBeTruthy()
      expect(s.bestFor.length).toBeGreaterThan(0)
    }
  })

  it('defines 5 music moods', () => {
    expect(MUSIC_MOOD_OPTIONS.map((m) => m.key)).toEqual([
      'suspenseful',
      'epic',
      'ambient',
      'upbeat',
      'emotional',
    ])
  })

  it('defines vertical, square, and widescreen aspect ratios with correct dimensions', () => {
    expect(ASPECT_RATIO_OPTIONS.map((a) => a.key)).toEqual(['9:16', '1:1', '16:9'])
    expect(getAspectRatioSpec('9:16')).toEqual(
      expect.objectContaining({ width: 1080, height: 1920 })
    )
    expect(getAspectRatioSpec('1:1')).toEqual(
      expect.objectContaining({ width: 1080, height: 1080 })
    )
    expect(getAspectRatioSpec('16:9')).toEqual(
      expect.objectContaining({ width: 1920, height: 1080 })
    )
  })

  it('validates project updates with trailerProjectUpdateSchema', () => {
    const valid = trailerProjectUpdateSchema.safeParse({
      title: 'Valid Book',
      length: '15s',
      style: 'dramatic',
      musicMood: 'epic',
      aspectRatios: ['9:16', '1:1'],
    })
    expect(valid.success).toBe(true)

    const empty = trailerProjectUpdateSchema.safeParse({})
    expect(empty.success).toBe(false)

    const invalidAspect = trailerProjectUpdateSchema.safeParse({
      aspectRatios: ['4:3'],
    })
    expect(invalidAspect.success).toBe(false)

    const withHookAndCta = trailerProjectUpdateSchema.safeParse({
      hookText: 'Some secrets refuse to stay buried.',
      ctaText: 'AVAILABLE NOW • GET YOUR COPY TODAY',
    })
    expect(withHookAndCta.success).toBe(true)
    if (withHookAndCta.success) {
      expect(withHookAndCta.data.hookText).toBe('Some secrets refuse to stay buried.')
      expect(withHookAndCta.data.ctaText).toBe('AVAILABLE NOW • GET YOUR COPY TODAY')
    }
  })
})
