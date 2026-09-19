import { describe, it, expect } from 'vitest'
import { PLATFORMS, TONES, TEMPLATES, getTemplate, projectUpdateSchema, COPY_LIMITS, adCopyUpdateSchema } from './options'

describe('ads options', () => {
  it('offers the Amazon platform, tones and templates', () => {
    expect(PLATFORMS.map((p) => p.key)).toEqual(['AMAZON'])
    expect(TONES.map((t) => t.key)).toEqual(['literary', 'punchy', 'bold', 'intriguing', 'social'])
    expect(TEMPLATES.map((t) => t.key)).toEqual([
      'classic',
      'bold',
      'minimal',
      'cinematic',
      'fantasy',
      'romance',
      'parchment',
      'scifi',
    ])
  })

  it('falls back to the classic template for unknown keys', () => {
    expect(getTemplate('nope').key).toBe('classic')
  })
})

describe('projectUpdateSchema', () => {
  it('accepts a details-only update', () => {
    expect(projectUpdateSchema.safeParse({ title: 'New title' }).success).toBe(true)
  })

  it('accepts a full config update with video parameters', () => {
    const r = projectUpdateSchema.safeParse({
      platforms: ['AMAZON'],
      copyTone: 'bold',
      templateKey: 'minimal',
      includeVideo: true,
      videoFormat: '16:9',
      videoStyle: 'cinematic',
      videoMood: 'epic',
      videoLength: '30s',
    })
    expect(r.success).toBe(true)
  })

  it('dedupes repeated platforms so a PATCH cannot create duplicate AdCopy rows', () => {
    const r = projectUpdateSchema.safeParse({ platforms: ['AMAZON', 'AMAZON'] })
    expect(r.success && r.data.platforms).toEqual(['AMAZON'])
  })

  it('rejects an empty platform list, unknown tone, and an empty body', () => {
    expect(projectUpdateSchema.safeParse({ platforms: [] }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({ copyTone: 'sarcastic' }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({}).success).toBe(false)
  })
})

describe('COPY_LIMITS', () => {
  it('gives a guide per platform that fits within what the API accepts', () => {
    expect(COPY_LIMITS.META).toEqual({ headline: 40, primaryText: 125, description: 90 })
    expect(COPY_LIMITS.GOOGLE).toEqual({ headline: 30, primaryText: 90, description: 90 })
    for (const limits of Object.values(COPY_LIMITS)) {
      const atLimit = {
        headline: 'x'.repeat(limits.headline),
        primaryText: 'x'.repeat(limits.primaryText),
        description: 'x'.repeat(limits.description),
      }
      expect(adCopyUpdateSchema.safeParse(atLimit).success).toBe(true)
    }
  })
})
