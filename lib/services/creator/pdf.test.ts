import { describe, it, expect } from 'vitest'
import { generateBookPdf } from './pdf'
import { sampleBookContent } from './generator'
import type { BookCreatorProjectData } from './types'

function makeMockProject(bookType: any): BookCreatorProjectData {
  const content = sampleBookContent({
    title: 'Test Starlight Book',
    bookType,
    promptConcept: 'A lovely test concept for verifying PDF compilation with images and spreads.',
    styleTheme: 'watercolor',
    targetAudience: 'early_readers',
    pageCount: 3,
  })

  return {
    id: 'proj_test_123',
    publisherId: 'pub_test',
    title: 'Test Starlight Book',
    subtitle: 'A Whimsical Tale of Magic',
    author: 'Elena Moon',
    bookType,
    genre: 'Fantasy',
    targetAudience: 'early_readers',
    styleTheme: 'watercolor',
    difficultyLevel: 'medium',
    promptConcept: 'A lovely test concept.',
    coverPrompt: 'A glowing star over the ocean',
    coverImageUrl: null,
    status: 'draft',
    metadata: null,
    content,
    wordCount: 500,
    pageCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('generateBookPdf', () => {
  it('generates a valid PDF for children books', async () => {
    const project = makeMockProject('children')
    const buffer = await generateBookPdf(project)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
    // Starts with PDF magic header %PDF-
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF for coloring books', async () => {
    const project = makeMockProject('coloring')
    const buffer = await generateBookPdf(project)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF for word game books', async () => {
    const project = makeMockProject('word_game')
    const buffer = await generateBookPdf(project)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('generates a valid PDF for story books', async () => {
    const project = makeMockProject('short_story')
    const buffer = await generateBookPdf(project)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('generateBookPdf with artwork', () => {
  it('embeds cover and page images', async () => {
    const { createCanvas } = await import('@napi-rs/canvas')
    const canvas = createCanvas(40, 30)
    canvas.getContext('2d').fillRect(0, 0, 40, 30)
    const dataUri = `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`

    const bare = makeMockProject('children')
    const illustrated = makeMockProject('children')
    illustrated.coverImageUrl = dataUri
    if (illustrated.content?.type === 'children') {
      illustrated.content.pages.forEach((p) => (p.generatedImageUrl = dataUri))
    }

    const [without, withArt] = await Promise.all([generateBookPdf(bare), generateBookPdf(illustrated)])
    // Embedded images show up as image XObjects in the PDF.
    expect(withArt.toString('latin1')).toContain('/Subtype /Image')
    expect(without.toString('latin1')).not.toContain('/Subtype /Image')
  })
})
