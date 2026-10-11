import { describe, it, expect } from 'vitest'
import { buildCoverUploadForm, buildLinkBookBody } from './addBook'

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

describe('buildLinkBookBody', () => {
  it('sends everything the link gave us, with the person’s own title and author', () => {
    const body = buildLinkBookBody(
      {
        title: 'Project Hail Mary: A Novel',
        blurb: 'A lone astronaut…',
        coverUrl: '/api/files/cover.jpg',
        sourceUrl: 'https://www.amazon.com/dp/0593135202',
        rating: 4.7,
        reviewCount: 283800,
        price: '$18.00',
        categories: ['Hard Science Fiction'],
        bullets: ['Now a major motion picture'],
      },
      { title: ' Project Hail Mary ', author: '' }
    )
    expect(body).toEqual({
      title: 'Project Hail Mary',
      author: '',
      blurb: 'A lone astronaut…',
      frontCoverUrl: '/api/files/cover.jpg',
      sourceUrl: 'https://www.amazon.com/dp/0593135202',
      rating: 4.7,
      reviewCount: 283800,
      price: '$18.00',
      categories: ['Hard Science Fiction'],
      bullets: ['Now a major motion picture'],
    })
  })
})
