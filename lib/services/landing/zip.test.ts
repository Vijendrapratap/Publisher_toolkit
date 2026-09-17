import { describe, it, expect } from 'vitest'
import { buildLandingZip, landingZipFileName } from './zip'
import JSZip from 'jszip'

describe('buildLandingZip', () => {
  it('generates a ZIP archive containing index.html and README.md', async () => {
    const zipBuffer = await buildLandingZip({
      title: 'Echoes of Starlight',
      author: 'E. Vance',
      template: 'bestseller',
      theme: 'matt',
      accentColor: '#6366f1',
      ctaText: 'Order Today',
    })

    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(zipBuffer)
    expect(zip.file('index.html')).not.toBeNull()
    expect(zip.file('README.md')).not.toBeNull()

    const html = await zip.file('index.html')!.async('string')
    expect(html).toContain('Echoes of Starlight')
  })

  it('formats zip filename cleanly', () => {
    expect(landingZipFileName('The Lost Crown: Part 1')).toBe('the-lost-crown-part-1-landing-website.zip')
  })
})
