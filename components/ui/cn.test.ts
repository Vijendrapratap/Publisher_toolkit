import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('drops falsy values and lets later Tailwind classes win', () => {
    expect(cn('px-2 py-1', false && 'hidden', undefined, 'px-4')).toBe('py-1 px-4')
  })
})
