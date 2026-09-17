import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountChip } from './AccountChip'

describe('AccountChip', () => {
  it('renders the interactive studio profile button with proper accessible attributes', () => {
    const html = renderToStaticMarkup(
      <AccountChip
        publisherId="dev-local-publisher"
        status={{ auth: 'local', storage: 'local', ai: 'local', adsPush: 'local' }}
        isClerk={false}
      />
    )
    expect(html).toContain('button')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('Publisher profile')
    expect(html).toContain('Local Publisher Studio')
    expect(html).toContain('LP')
  })

  it('renders the active session indicator', () => {
    const html = renderToStaticMarkup(
      <AccountChip
        publisherId="dev-local-publisher"
        isClerk={false}
      />
    )
    expect(html).toContain('bg-success')
    expect(html).toContain('Local Session Active')
  })
})
