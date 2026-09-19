import { describe, it, expect } from 'vitest'
import { runAuthorLandingAgent, sampleAuthorLanding } from './agent'

describe('authorLandingAgent', () => {
  it('generates rich author-centric landing content from sample when AI unconfigured', () => {
    const res = sampleAuthorLanding({
      bookTitle: 'The Echo Chamber',
      authorName: 'Dr. Evelyn Vance',
      authorPersona: 'Forensic psychologist with 15 years profiling serial offenders',
      authorVoice: 'Cerebral, haunting, unflinching',
      primaryObjective: 'preorder',
      targetAudience: 'Fans of Mindhunter and Silence of the Lambs',
    })

    expect(res.headline).toContain('Evelyn Vance')
    expect(res.authorBio).toContain('Forensic psychologist')
    expect(res.ctaText).toBe('Order Your Copy Today')
    expect(res.reviews.length).toBeGreaterThanOrEqual(2)
    expect(res.recommendedTemplate).toBe('bestseller')
  })

  it('adapts CTA and template for newsletter objective', () => {
    const res = sampleAuthorLanding({
      bookTitle: 'Shadow of the Eclipse',
      authorName: 'Kaelen Vance',
      primaryObjective: 'newsletter',
      readerMagnet: 'Download the exclusive prologue novella',
    })

    expect(res.ctaText).toBe('Join Inner Circle & Read Free Excerpt')
    expect(res.newsletterIncentive).toBe('Download the exclusive prologue novella')
    expect(res.recommendedTemplate).toBe('minimal')
  })
})
