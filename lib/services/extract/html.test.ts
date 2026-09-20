import { describe, it, expect } from 'vitest'
import { attr, decodeHtmlEntities, findTagById, innerHtmlById, metaContent, stripHtml } from './html'

describe('attr', () => {
  it('reads an attribute wherever it sits in the tag', () => {
    const tag = '<img alt="x" src="a.jpg" data-old-hires="b.jpg" id="landingImage" class="c">'
    expect(attr(tag, 'id')).toBe('landingImage')
    expect(attr(tag, 'src')).toBe('a.jpg')
    expect(attr(tag, 'data-old-hires')).toBe('b.jpg')
  })

  it('handles single quotes and decodes entities', () => {
    expect(attr("<a title='Tom &amp; Jerry'>", 'title')).toBe('Tom & Jerry')
  })

  it('does not match an attribute that is merely a suffix of another', () => {
    expect(attr('<img data-src="a.jpg">', 'src')).toBeNull()
  })
})

describe('findTagById', () => {
  it('finds the tag regardless of attribute order', () => {
    const html = '<div class="a">x</div><div data-x="1" id="want" class="b">y</div>'
    expect(findTagById(html, 'div', 'want')).toContain('id="want"')
  })

  it('returns null rather than a near-miss', () => {
    expect(findTagById('<div id="wanted">', 'div', 'want')).toBeNull()
  })
})

describe('innerHtmlById', () => {
  it('spans nested tags of the same name instead of stopping at the first close', () => {
    const html = '<div id="outer"><div><p>deep</p></div><span>tail</span></div><div>after</div>'
    const inner = innerHtmlById(html, 'div', 'outer')

    expect(inner).toContain('deep')
    expect(inner).toContain('tail')
    expect(inner).not.toContain('after')
  })

  it('returns the whole body, not just the tail after the last nested tag', () => {
    const html = '<div id="o"><div>first</div>middle<div>last</div></div>'
    expect(innerHtmlById(html, 'div', 'o')).toBe('<div>first</div>middle<div>last</div>')
  })

  it('returns null for an unclosed element', () => {
    expect(innerHtmlById('<div id="o"><div>x</div>', 'div', 'o')).toBeNull()
  })
})

describe('stripHtml', () => {
  it('drops script and style bodies rather than inlining them', () => {
    expect(stripHtml('<p>keep</p><script>var a = 1</script><style>.x{}</style>')).toBe('keep')
  })
})

describe('decodeHtmlEntities', () => {
  it('decodes the ampersand last so escaped entities survive', () => {
    expect(decodeHtmlEntities('&amp;lt;tag&amp;gt;')).toBe('&lt;tag&gt;')
  })

  it('decodes numeric and hex references', () => {
    expect(decodeHtmlEntities('caf&#233; &#x2014; bar')).toBe('café — bar')
  })
})

describe('metaContent', () => {
  it('matches property or name, in either attribute order', () => {
    const html = '<meta content="A" property="og:title"><meta name="author" content="B">'
    expect(metaContent(html, 'og:title')).toBe('A')
    expect(metaContent(html, 'author')).toBe('B')
    expect(metaContent(html, 'missing')).toBeNull()
  })
})
