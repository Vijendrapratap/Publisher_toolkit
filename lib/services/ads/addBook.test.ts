import { describe, it, expect } from 'vitest'
import { buildCoverUploadForm } from './addBook'

const file = (name: string) => new File([new Uint8Array([1])], name, { type: 'image/png' })

describe('buildCoverUploadForm', () => {
  it('sends the cover, details and every inside page the create route reads', () => {
    const form = buildCoverUploadForm({
      title: '  Owl Woods ',
      author: ' Eliza ',
      cover: file('cover.png'),
      insidePages: [file('p1.png'), file('p2.png')],
    })
    expect(form.get('title')).toBe('Owl Woods')
    expect(form.get('author')).toBe('Eliza')
    expect((form.get('frontCover') as File).name).toBe('cover.png')
    expect(form.getAll('interiorImages').map((f) => (f as File).name)).toEqual(['p1.png', 'p2.png'])
  })
})
