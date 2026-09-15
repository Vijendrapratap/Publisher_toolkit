import { describe, it, expect } from 'vitest'
import { nextRadioIndex } from './radioKeys'

describe('nextRadioIndex', () => {
  it('ArrowDown moves to the next index', () => {
    expect(nextRadioIndex('ArrowDown', 0, 3)).toBe(1)
  })

  it('ArrowRight moves to the next index', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1)
  })

  it('ArrowDown wraps from the last index to 0', () => {
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0)
  })

  it('ArrowRight wraps from the last index to 0', () => {
    expect(nextRadioIndex('ArrowRight', 2, 3)).toBe(0)
  })

  it('ArrowUp moves to the previous index', () => {
    expect(nextRadioIndex('ArrowUp', 2, 3)).toBe(1)
  })

  it('ArrowLeft moves to the previous index', () => {
    expect(nextRadioIndex('ArrowLeft', 2, 3)).toBe(1)
  })

  it('ArrowUp wraps from index 0 to the last index', () => {
    expect(nextRadioIndex('ArrowUp', 0, 3)).toBe(2)
  })

  it('ArrowLeft wraps from index 0 to the last index', () => {
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2)
  })

  it('Home moves to index 0', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0)
  })

  it('End moves to the last index', () => {
    expect(nextRadioIndex('End', 0, 3)).toBe(2)
  })

  it('an unrelated key returns null', () => {
    expect(nextRadioIndex('Tab', 0, 3)).toBeNull()
    expect(nextRadioIndex('a', 1, 3)).toBeNull()
    expect(nextRadioIndex('Enter', 1, 3)).toBeNull()
  })
})
