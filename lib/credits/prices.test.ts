import { describe, expect, it } from 'vitest'
import { CREDIT_PRICES, goalCreditLabel } from './prices'

describe('credit prices', () => {
  it('labels each ad goal with its table price', () => {
    expect(goalCreditLabel('aplus')).toBe(`${CREDIT_PRICES['ads.aplus']} credits`)
    expect(goalCreditLabel('sponsored')).toBe(`${CREDIT_PRICES['ads.image']} credits`)
    expect(goalCreditLabel('video')).toBe(`from ${CREDIT_PRICES['ads.video.instant']} credits`)
  })
})
