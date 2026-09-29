import { describe, it, expect } from 'vitest'
import { goalSizes, goalWantsVideo } from './goal'

const keys = (goal: string | null) => goalSizes(goal, ['AMAZON']).map((s) => s.key)

describe('content goal scoping', () => {
  it('renders only the sizes the goal was bought for', () => {
    expect(keys('sponsored')).toEqual(['amazon_300x250', 'amazon_1200x628'])
    expect(keys('aplus')).toEqual([
      'amazon_aplus_banner_970x600',
      'amazon_aplus_feature_970x300',
      'amazon_aplus_square_300x300',
    ])
    expect(keys('video')).toEqual([])
  })

  it('keeps the full bundle for legacy/all projects', () => {
    expect(keys('all')).toHaveLength(5)
    expect(keys(null)).toHaveLength(5)
  })

  it('only makes a trailer for video or bundle goals', () => {
    expect(goalWantsVideo('video', false)).toBe(true)
    expect(goalWantsVideo('sponsored', true)).toBe(false)
    expect(goalWantsVideo('aplus', null)).toBe(false)
    expect(goalWantsVideo('all', null)).toBe(true)
    expect(goalWantsVideo('all', false)).toBe(false)
  })
})
