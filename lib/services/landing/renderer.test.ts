import { describe, it, expect } from 'vitest'
import { renderLandingPageHtml } from './renderer'

describe('renderLandingPageHtml', () => {
  it('renders a complete HTML document with title, author, and buy links', () => {
    const html = renderLandingPageHtml({
      title: 'The Silent Horizon',
      subtitle: 'A journey across uncharted galaxies',
      author: 'Aria Vance',
      template: 'bestseller',
      theme: 'matt',
      accentColor: '#38bdf8',
      ctaText: 'Get Your Copy',
      retailerLinks: [{ retailer: 'Amazon', url: 'https://amazon.com/dp/123456' }],
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('The Silent Horizon')
    expect(html).toContain('Aria Vance')
    expect(html).toContain('Get Your Copy')
    expect(html).toContain('https://amazon.com/dp/123456')
    expect(html).toContain('Amazon')
    expect(html).toContain('Sample Chapter')
  })

  it('escapes special characters safely', () => {
    const html = renderLandingPageHtml({
      title: 'Danger & Glory <Script>',
      author: 'Test "Author"',
      template: 'minimal',
      theme: 'dark',
      accentColor: '#6366f1',
      ctaText: 'Buy',
    })

    expect(html).not.toContain('<Script>')
    expect(html).toContain('Danger &amp; Glory &lt;Script&gt;')
  })
})
