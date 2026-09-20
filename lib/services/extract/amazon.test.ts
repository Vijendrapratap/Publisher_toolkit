import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractAmazonFacts,
  isAmazonUrl,
  largestDynamicImage,
  upgradeImageUrl,
} from './amazon'

// Reproduces the real markup shapes observed on amazon.com, including the
// attribute ordering and the decoy rating block that broke the old parser.
const html = readFileSync(join(__dirname, 'fixtures/amazon-book.html'), 'utf-8')
const facts = extractAmazonFacts(html, 'https://www.amazon.com/dp/0735211299')

describe('extractAmazonFacts', () => {
  it('picks the largest rendition from data-a-dynamic-image, not the thumbnail in src', () => {
    expect(facts.coverImageUrl).toContain('8106lPWfXpL')
    expect(facts.coverImageUrl).not.toContain('_SY342_')
    expect(facts.coverImageUrl).not.toContain('417nMGle9rL')
  })

  it('reads the rating and review count from the review widget, not the first match on the page', () => {
    expect(facts.rating).toBe(4.8)
    expect(facts.reviewCount).toBe(149911)
    // The decoy carousel says 4.1 / 935 — the old unscoped regex returned those.
    expect(facts.reviewCount).not.toBe(935)
  })

  it('reads the price from the core price block', () => {
    expect(facts.price).toBe('$13.99')
  })

  it('reads the ASIN from the URL', () => {
    expect(facts.asin).toBe('0735211299')
  })

  it('collects bestseller categories, dropping the useless root shelf', () => {
    expect(facts.categories).toEqual(['Habit Formation Self-Help', 'Business & Money'])
    expect(facts.categories).not.toContain('Books')
  })

  it('collects feature bullets and skips the expander control', () => {
    expect(facts.bullets).toEqual([
      'Over 2,000 words with solutions included',
      'Extra large print for comfortable reading',
    ])
  })

  it('reads the book facts carousel', () => {
    expect(facts.printLength).toBe(320)
    expect(facts.publisher).toBe('Avery')
    expect(facts.publicationDate).toBe('October 16, 2018')
  })
})

describe('largestDynamicImage', () => {
  it('picks the widest entry', () => {
    expect(largestDynamicImage('{"small.jpg":[100,80],"big.jpg":[900,600]}')).toBe('big.jpg')
  })

  it('returns null for absent or unparsable values', () => {
    expect(largestDynamicImage(null)).toBeNull()
    expect(largestDynamicImage('not json')).toBeNull()
  })
})

describe('upgradeImageUrl', () => {
  it('rewrites the rendition suffix to request a large image', () => {
    expect(upgradeImageUrl('https://m.media-amazon.com/images/I/81abc._SY342_SX200_.jpg')).toBe(
      'https://m.media-amazon.com/images/I/81abc._SL1600_.jpg'
    )
  })

  it('leaves a URL without a rendition suffix alone', () => {
    expect(upgradeImageUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg')
  })
})

describe('isAmazonUrl', () => {
  it.each([
    ['https://www.amazon.com/dp/1', true],
    ['https://amazon.co.uk/dp/1', true],
    ['https://www.amazon.in/dp/1', true],
    ['https://notamazon.com/dp/1', false],
    ['https://amazon.com.evil.test/dp/1', false],
  ])('%s -> %s', (url, expected) => {
    expect(isAmazonUrl(new URL(url))).toBe(expected)
  })
})
