import { describe, it, expect } from 'vitest'
import {
  LANDING_TEMPLATES,
  THEME_OPTIONS,
  landingProjectUpdateSchema,
} from './options'

describe('landing options', () => {
  it('defines 5 templates including bestseller, editorial, and fantasy', () => {
    expect(LANDING_TEMPLATES.map((t) => t.key)).toEqual([
      'bestseller',
      'editorial',
      'fantasy',
      'minimal',
      'romance',
    ])
  })

  it('defines matt, dark, and light themes', () => {
    expect(THEME_OPTIONS.map((t) => t.key)).toEqual(['matt', 'dark', 'light'])
  })

  it('validates landing project updates', () => {
    const valid = landingProjectUpdateSchema.safeParse({
      title: 'Valid Book',
      template: 'editorial',
      theme: 'matt',
      accentColor: '#ef4444',
      ctaText: 'Order Now',
    })
    expect(valid.success).toBe(true)

    const invalidAccent = landingProjectUpdateSchema.safeParse({
      accentColor: 'not-a-color',
    })
    expect(invalidAccent.success).toBe(false)
  })
})
