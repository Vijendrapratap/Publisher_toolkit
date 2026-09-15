import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field, Input } from './field'

describe('Field', () => {
  it('wires the error text to the input via aria-invalid and aria-describedby', () => {
    const html = renderToStaticMarkup(
      <Field label="Name" htmlFor="name" error="Too long">
        <Input id="name" />
      </Field>
    )
    expect(html).toContain('aria-invalid="true"')
    const inputMatch = html.match(/<input[^>]*aria-describedby="([^"]+)"[^>]*>/)
    expect(inputMatch).not.toBeNull()
    const describedById = inputMatch![1]
    const errorParagraphMatch = html.match(/<p id="([^"]+)"[^>]*role="alert"[^>]*>/)
    expect(errorParagraphMatch).not.toBeNull()
    expect(describedById).toBe(errorParagraphMatch![1])
  })

  it('wires the hint text to the input via aria-describedby and sets no aria-invalid', () => {
    const html = renderToStaticMarkup(
      <Field label="Name" htmlFor="name" hint="Used for copy">
        <Input id="name" />
      </Field>
    )
    expect(html).not.toContain('aria-invalid')
    const inputMatch = html.match(/<input[^>]*aria-describedby="([^"]+)"[^>]*>/)
    expect(inputMatch).not.toBeNull()
    const describedById = inputMatch![1]
    const hintParagraphMatch = html.match(/<p[^>]*id="([^"]+)"[^>]*>Used for copy<\/p>/)
    expect(hintParagraphMatch).not.toBeNull()
    expect(describedById).toBe(hintParagraphMatch![1])
  })
})
