import { describe, expect, it } from 'vitest'
import { CREDIT_PRICES, adsGenerationAction, aiVideoUnits, goalCreditLabel } from './prices'

describe('credit prices', () => {
  it('labels each ad goal with its table price', () => {
    expect(goalCreditLabel('aplus')).toBe(`${CREDIT_PRICES['ads.aplus']} credits`)
    expect(goalCreditLabel('sponsored')).toBe(`${CREDIT_PRICES['ads.image']} credits`)
    expect(goalCreditLabel('video')).toBe(`from ${CREDIT_PRICES['ads.video.instant']} credits`)
  })

  it('maps a stored content goal to the action that is charged', () => {
    expect(adsGenerationAction('aplus')).toBe('ads.aplus')
    expect(adsGenerationAction('sponsored')).toBe('ads.image')
    expect(adsGenerationAction('video')).toBe('ads.video.instant')
    expect(adsGenerationAction('all')).toBe('ads.bundle')
    expect(adsGenerationAction(null)).toBe('ads.bundle')
  })

  it('counts AI video units as 5-second blocks, at least one per shot', () => {
    expect(aiVideoUnits([5, 5])).toBe(2)
    expect(aiVideoUnits([10])).toBe(2)
    expect(aiVideoUnits([3])).toBe(1)
  })
})
