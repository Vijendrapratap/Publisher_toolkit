import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { renderAdFrame } from './render'
import { AD_FORMATS, AD_PRESETS, getPreset, inferPreset } from './presets'

/** A recognisable stand-in cover, so drawCover takes its image path. */
function fakeCover(): Buffer {
  const canvas = createCanvas(600, 900)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f7c6dd'
  ctx.fillRect(0, 0, 600, 900)
  return canvas.toBuffer('image/png')
}

const book = {
  title: '2027 Spring Large Print Word Search',
  author: 'April Rally',
  headline: '2,000 words with solutions included',
  benefits: ['EXTRA LARGE PRINT', '100 INTERESTING THEMES', 'SOLUTIONS INCLUDED'],
  ctaText: 'GET YOUR COPY TODAY',
  rating: 4.7,
  reviewCount: 1843,
  price: '$13.99',
}

describe('renderAdFrame', () => {
  // Painting is where layout breaks; encoding is ffmpeg's problem. Covering
  // every preset and format here stays fast enough to keep in the suite.
  for (const preset of AD_PRESETS) {
    for (const format of AD_FORMATS) {
      // Rasterising 1080p frames is real work, and the suite runs one worker
      // per file, so the default 5s budget is not realistic here.
      it(`paints ${preset.key} at ${format.key} without throwing`, { timeout: 30_000 }, async () => {
        const cover = fakeCover()
        // Start, middle and end of the plan: enough to enter every beat.
        for (const progress of [0.05, 0.5, 0.95]) {
          const png = await renderAdFrame({
            ...book,
            preset: preset.key,
            format: format.key,
            length: '20s',
            coverBuffer: cover,
            interiorBuffers: [cover],
            atProgress: progress,
          })
          expect(png.length).toBeGreaterThan(1000)
        }
      })
    }
  }

  it('produces a poster sized to the chosen format', async () => {
    const png = await renderAdFrame({
      ...book,
      preset: 'puzzle',
      format: '9:16',
      length: '15s',
      atProgress: 0.1,
    })
    // PNG header carries the dimensions at a fixed offset.
    expect(png.readUInt32BE(16)).toBe(1080)
    expect(png.readUInt32BE(20)).toBe(1920)
  })

  it('still paints when the book has no cover and no interiors', async () => {
    const png = await renderAdFrame({
      ...book,
      preset: 'trade',
      format: '1:1',
      length: '6s',
      coverBuffer: null,
      interiorBuffers: [],
      rating: null,
      reviewCount: null,
      price: null,
      atProgress: 0.5,
    })
    expect(png.length).toBeGreaterThan(1000)
  })
})

describe('inferPreset', () => {
  it('maps a create-book type straight through', () => {
    expect(inferPreset({ bookType: 'coloring' }).key).toBe('coloring')
    expect(inferPreset({ bookType: 'word_game' }).key).toBe('puzzle')
  })

  it('reads the genre out of Amazon bestseller categories', () => {
    expect(inferPreset({ categories: ['Word Search Puzzles', 'Games'] }).key).toBe('puzzle')
    expect(inferPreset({ categories: ["Children's Bedtime Books"] }).key).toBe('children')
  })

  it("falls back to the title when there are no categories", () => {
    expect(inferPreset({ title: 'Big Coloring Fun' }).key).toBe('coloring')
  })

  it('defaults to the trade preset rather than guessing', () => {
    expect(inferPreset({ title: 'A Quiet Life' }).key).toBe('trade')
    expect(getPreset('nonsense').key).toBe('trade')
  })
})
