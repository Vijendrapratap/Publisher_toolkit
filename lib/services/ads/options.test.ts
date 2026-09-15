import { describe, it, expect } from 'vitest'
import { PLATFORMS, TONES, TEMPLATES, getTemplate, projectUpdateSchema } from './options'

describe('ads options', () => {
  it('offers the three platforms, tones and templates', () => {
    expect(PLATFORMS.map((p) => p.key)).toEqual(['META', 'GOOGLE', 'AMAZON'])
    expect(TONES.map((t) => t.key)).toEqual(['literary', 'punchy', 'bold'])
    expect(TEMPLATES.map((t) => t.key)).toEqual(['classic', 'bold', 'minimal'])
  })

  it('falls back to the classic template for unknown keys', () => {
    expect(getTemplate('nope').key).toBe('classic')
  })
})

describe('projectUpdateSchema', () => {
  it('accepts a details-only update', () => {
    expect(projectUpdateSchema.safeParse({ title: 'New title' }).success).toBe(true)
  })

  it('accepts a full config update', () => {
    const r = projectUpdateSchema.safeParse({ platforms: ['META'], copyTone: 'bold', templateKey: 'minimal' })
    expect(r.success).toBe(true)
  })

  it('rejects an empty platform list, unknown tone, and an empty body', () => {
    expect(projectUpdateSchema.safeParse({ platforms: [] }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({ copyTone: 'sarcastic' }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({}).success).toBe(false)
  })
})
