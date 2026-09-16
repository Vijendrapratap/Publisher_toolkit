import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button, buttonClasses } from './button'

describe('Button', () => {
  it('renders the primary style by default', () => {
    const html = renderToStaticMarkup(<Button>Go</Button>)
    expect(html).toContain('bg-accent')
    expect(html).toContain('>Go<')
  })

  it('is disabled and busy while loading', () => {
    const html = renderToStaticMarkup(<Button loading>Saving</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
  })

  it('exposes the same classes for links', () => {
    expect(buttonClasses({ variant: 'secondary' })).toContain('bg-surface')
  })
})
