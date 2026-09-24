import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreditBalance } from './CreditBalance'

describe('CreditBalance', () => {
  it('links to /credits and shows a loading placeholder before the balance loads', () => {
    const html = renderToStaticMarkup(<CreditBalance />)
    expect(html).toContain('href="/credits"')
    expect(html).toContain('aria-label="Credits"')
    expect(html).toContain('–')
  })
})
