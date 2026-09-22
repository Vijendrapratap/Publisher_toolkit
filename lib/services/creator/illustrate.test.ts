import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/ai', () => ({ generateAiImage: vi.fn() }))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn(async (pathname: string) => ({ url: `/api/files/${pathname}` })),
}))

import { generateAiImage } from '@/lib/providers/ai'
import { buildStyleBible, countIllustrations, illustrateProject } from './illustrate'
import type { GeneratedBookContent } from './types'

const childrenBook = (): GeneratedBookContent => ({
  type: 'children',
  pages: [
    {
      pageNumber: 1,
      storyText: 'Barnaby found a star.',
      characterFocus: 'Barnaby, a small brown bear cub with round ears',
      illustrationPrompt: 'A bear cub on a mossy log',
    },
    {
      pageNumber: 2,
      storyText: 'Pip arrived.',
      characterFocus: 'Pip, a hedgehog in round spectacles',
      illustrationPrompt: 'A hedgehog beside the bear',
    },
  ],
})

const image = { buffer: Buffer.from('png'), contentType: 'image/png', dataUri: 'data:' }
const run = (content: GeneratedBookContent, regenerate = false) =>
  illustrateProject({
    projectId: 'proj_1',
    publisherId: 'pub_1',
    title: 'Barnaby and the Star',
    styleTheme: 'soft watercolour',
    content,
    regenerate,
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(generateAiImage).mockResolvedValue(image)
})

describe('buildStyleBible', () => {
  it('locks the recurring cast so pages drawn separately still match', () => {
    const bible = buildStyleBible(childrenBook(), 'soft watercolour')
    expect(bible).toContain('soft watercolour')
    expect(bible).toContain('Barnaby')
    expect(bible).toContain('Pip')
  })

  it('does not repeat a character that appears on several pages', () => {
    const content = childrenBook()
    content.type === 'children' && (content.pages[1].characterFocus = content.pages[0].characterFocus)
    expect(buildStyleBible(content, 'x').match(/Barnaby/g)).toHaveLength(1)
  })
})

describe('illustrateProject', () => {
  it('draws every page plus a cover and records the urls', async () => {
    const result = await run(childrenBook())

    expect(generateAiImage).toHaveBeenCalledTimes(3)
    expect(result.succeeded).toBe(3)
    expect(result.failures).toEqual([])
    expect(result.coverImageUrl).toContain('cover')

    const pages = result.content.type === 'children' ? result.content.pages : []
    expect(pages.every((p) => p.generatedImageUrl)).toBe(true)
  })

  it('carries the style bible into every page prompt', async () => {
    await run(childrenBook())
    const prompts = vi.mocked(generateAiImage).mock.calls.map(([prompt]) => prompt)

    // The first two are pages; each must restate the cast and the style.
    expect(prompts[0]).toContain('soft watercolour')
    expect(prompts[1]).toContain('Barnaby')
  })

  it('forbids lettering, which image models cannot spell', async () => {
    await run(childrenBook())
    for (const [prompt] of vi.mocked(generateAiImage).mock.calls) {
      expect(prompt.toLowerCase()).toMatch(/no text|do not draw any text/)
    }
  })

  it('demands printable line art for coloring pages', async () => {
    await run({
      type: 'coloring',
      pages: [
        {
          pageNumber: 1,
          title: 'Dragon',
          sceneDescription: 'A sleeping dragon',
          lineArtPrompt: 'a dragon on a moon',
          detailLevel: 'simple',
        },
      ],
    })

    const [pagePrompt] = vi.mocked(generateAiImage).mock.calls[0]
    expect(pagePrompt).toContain('Pure black outlines')
    expect(pagePrompt).toMatch(/no shading/i)
  })

  it('only fills the gaps on a re-run, so finished pages are not paid for twice', async () => {
    const content = childrenBook()
    if (content.type === 'children') content.pages[0].generatedImageUrl = '/already/there.png'

    await run(content)

    // One remaining page plus the cover.
    expect(generateAiImage).toHaveBeenCalledTimes(2)
  })

  it('redraws everything when the publisher explicitly asks', async () => {
    const content = childrenBook()
    if (content.type === 'children') content.pages[0].generatedImageUrl = '/already/there.png'

    await run(content, true)
    expect(generateAiImage).toHaveBeenCalledTimes(3)
  })

  it('keeps the pages that worked when some fail', async () => {
    vi.mocked(generateAiImage)
      .mockResolvedValueOnce(image)
      .mockResolvedValue(null)

    const result = await run(childrenBook())

    expect(result.succeeded).toBe(1)
    expect(result.failures.length).toBeGreaterThan(0)
    expect(result.coverImageUrl).toBeNull()
  })

  it('never mutates the caller\'s content', async () => {
    const content = childrenBook()
    await run(content)
    const pages = content.type === 'children' ? content.pages : []
    expect(pages.every((p) => p.generatedImageUrl === undefined)).toBe(true)
  })

  it('illustrates scene artwork and cover for story books', async () => {
    const result = await run({
      type: 'short_story',
      story: { title: 'X', synopsis: 'Y', theme: 'Z', storyText: 'W', wordCount: 1, readingTimeMinutes: 1 },
    })

    expect(generateAiImage).toHaveBeenCalledTimes(2)
    expect(result.requested).toBe(2)
    expect(result.succeeded).toBe(2)
  })

  it('illustrates puzzle artwork and cover for word games', async () => {
    const result = await run({
      type: 'word_game',
      wordSearches: [
        {
          puzzleNumber: 1,
          title: 'Ocean',
          theme: 'Fish',
          gridSize: 10,
          grid: [['A']],
          wordList: ['FISH'],
        },
      ],
    })

    expect(generateAiImage).toHaveBeenCalledTimes(2)
    expect(result.requested).toBe(2)
    expect(result.succeeded).toBe(2)
  })
})

describe('countIllustrations', () => {
  it('counts every page plus the cover', () => {
    expect(countIllustrations(childrenBook())).toBe(3)
  })

  it('counts story scene plus cover for story books', () => {
    expect(
      countIllustrations({
        type: 'short_story',
        story: { title: 'X', synopsis: 'Y', theme: 'Z', storyText: 'W', wordCount: 1, readingTimeMinutes: 1 },
      })
    ).toBe(2)
  })

  it('counts puzzle themes plus cover for word game books', () => {
    expect(
      countIllustrations({
        type: 'word_game',
        wordSearches: [
          { puzzleNumber: 1, title: 'A', theme: 'T', gridSize: 10, grid: [], wordList: [] },
          { puzzleNumber: 2, title: 'B', theme: 'T', gridSize: 10, grid: [], wordList: [] },
        ],
      })
    ).toBe(3)
  })
})
