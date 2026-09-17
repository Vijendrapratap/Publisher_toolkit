import { describe, it, expect } from 'vitest'
import {
  LENGTH_OPTIONS,
  STYLE_OPTIONS,
  MUSIC_MOOD_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  getAspectRatioSpec,
  getDurationForLength,
  trailerProjectUpdateSchema,
} from './options'

describe('trailer options', () => {
  it('defines 15s, 30s, and 60s lengths with accurate duration seconds', () => {
    expect(LENGTH_OPTIONS.map((l) => l.key)).toEqual(['15s', '30s', '60s'])
    expect(getDurationForLength('15s')).toBe(15)
    expect(getDurationForLength('30s')).toBe(30)
    expect(getDurationForLength('60s')).toBe(60)
    expect(getDurationForLength('unknown')).toBe(30)
  })

  it('defines 4 visual styles', () => {
    expect(STYLE_OPTIONS.map((s) => s.key)).toEqual(['cinematic', 'dramatic', 'minimal', 'energetic'])
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
  })
})
