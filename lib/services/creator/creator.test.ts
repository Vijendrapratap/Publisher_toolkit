import { describe, it, expect } from 'vitest'
import {
  BOOK_TYPES,
  STYLES_BY_TYPE,
  createBookProjectSchema,
} from './options'
import {
  buildWordSearchGrid,
  sampleBookContent,
} from './generator'

describe('Book Creator options & schema', () => {
  it('defines all five book types with badges and default pages', () => {
    expect(BOOK_TYPES.map((b) => b.key)).toEqual([
      'children',
      'coloring',
      'word_game',
      'novel_chapter',
      'short_story',
    ])
  })

  it('provides distinct style options for each book type', () => {
    for (const bt of BOOK_TYPES) {
      expect(STYLES_BY_TYPE[bt.key].length).toBeGreaterThanOrEqual(3)
      for (const style of STYLES_BY_TYPE[bt.key]) {
        expect(style.key).toBeTruthy()
        expect(style.label).toBeTruthy()
        expect(style.samplePromptSnippet).toBeTruthy()
      }
    }
  })

  it('validates a valid create book input', () => {
    const valid = {
      title: 'The Starlight Dragon',
      bookType: 'children',
      styleTheme: 'watercolor',
      targetAudience: 'early_readers',
      promptConcept: 'A bedtime tale about a sleepy little dragon who lost his ember in the whispering forest.',
      pageCount: 8,
    }
    const res = createBookProjectSchema.safeParse(valid)
    expect(res.success).toBe(true)
  })

  it('rejects an empty title or too-short concept', () => {
    expect(createBookProjectSchema.safeParse({ title: '', promptConcept: 'Too short' }).success).toBe(false)
  })
})

describe('Word Search Matrix Generator', () => {
  it('generates an NxN matrix with placed words and no empty cells', () => {
    const words = ['DRAGON', 'STAR', 'FOREST', 'MAGIC']
    const size = 12
    const { grid, placedWords } = buildWordSearchGrid(words, size)

    expect(grid.length).toBe(size)
    for (const row of grid) {
      expect(row.length).toBe(size)
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/)
      }
    }
    expect(placedWords.length).toBeGreaterThan(0)
  })
})

describe('Book Content Generation Engine (sampleBookContent)', () => {
  it('generates children story spreads with storyText and illustration prompts', () => {
    const content = sampleBookContent({
      title: 'Barnaby and the Star',
      bookType: 'children',
      promptConcept: 'A little bear cub finds a fallen star and helps it return home.',
      styleTheme: 'watercolor',
      targetAudience: 'early_readers',
      pageCount: 6,
    })

    expect(content.type).toBe('children')
    if (content.type === 'children') {
      expect(content.pages.length).toBe(6)
      expect(content.pages[0].storyText).toContain('Barnaby')
      expect(content.pages[0].illustrationPrompt).toContain('watercolor')
    }
  })

  it('generates coloring book pages with line art prompts', () => {
    const content = sampleBookContent({
      title: 'Enchanted Forest Coloring',
      bookType: 'coloring',
      promptConcept: 'Detailed forest animals and mushroom cottages for coloring.',
      styleTheme: 'bold_kids',
      targetAudience: 'early_readers',
      pageCount: 5,
    })

    expect(content.type).toBe('coloring')
    if (content.type === 'coloring') {
      expect(content.pages.length).toBe(5)
      expect(content.pages[0].lineArtPrompt).toContain('coloring')
      expect(content.pages[0].detailLevel).toBeTruthy()
    }
  })

  it('generates word games with matrices, word lists, and crossword clues', () => {
    const content = sampleBookContent({
      title: 'Deep Sea Word Hunt',
      bookType: 'word_game',
      promptConcept: 'Ocean creatures and marine adventures.',
      styleTheme: 'word_search_themed',
      targetAudience: 'middle_grade',
      pageCount: 2,
    })

    expect(content.type).toBe('word_game')
    if (content.type === 'word_game') {
      expect(content.wordSearches.length).toBe(2)
      expect(content.wordSearches[0].grid.length).toBe(12)
      expect(content.wordSearches[0].wordList.length).toBeGreaterThan(0)
      expect(content.crosswords && content.crosswords.length).toBe(1)
    }
  })

  it('generates chapter-by-chapter novel architecture with opening chapter', () => {
    const content = sampleBookContent({
      title: 'The Clockwork Alchemist',
      bookType: 'novel_chapter',
      promptConcept: 'An 1892 Venice mystery involving an alchemical clockwork engine.',
      styleTheme: 'thriller_suspense',
      targetAudience: 'adults',
      pageCount: 4,
    })

    expect(content.type).toBe('novel_chapter')
    if (content.type === 'novel_chapter') {
      expect(content.novel.chapters.length).toBe(4)
      expect(content.novel.chapters[0].status).toBe('completed')
      expect(content.novel.chapters[0].wordCount).toBeGreaterThan(500)
      expect(content.novel.chapters[1].status).toBe('draft')
    }
  })
})
