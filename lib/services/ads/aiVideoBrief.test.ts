import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/ai', () => ({ generateStructured: vi.fn() }))

import { generateStructured } from '@/lib/providers/ai'
import { generateAiVideoBrief } from './aiVideoBrief'
import { aiVideoBriefSchema, buildBriefPrompt, fallbackBrief, imageKeys, type AiVideoBrief } from './aiVideoBriefSchema'

const facts = { title: 'Learning RAG', author: 'Pratap', blurb: 'Build retrieval systems.', cta: 'Pre-order now', pageCount: 1 }
const brief: AiVideoBrief = {
  shots: [{ prompt: 'Slow push-in on the cover with a light sweep', sourceImage: 'page-9', durationSec: 5, caption: '' }],
  endCard: { headline: 'Build RAG that works', cta: 'Pre-order now' },
}

// Block body: an arrow function that returns a value from `beforeEach` has that
// value treated as an implicit cleanup hook, and `mockReset()` returns the mock
// itself (a function) — which Vitest would then invoke again after each test.
beforeEach(() => {
  vi.mocked(generateStructured).mockReset()
})

describe('imageKeys', () => {
  it('lists the cover and each page', () => {
    expect(imageKeys(2)).toEqual(['cover', 'page-1', 'page-2'])
  })
})

describe('buildBriefPrompt', () => {
  it('names the usable images and the format for a first draft', () => {
    const prompt = buildBriefPrompt(facts, { format: '16:9', instruction: 'moody' })
    expect(prompt).toContain('cover, page-1')
    expect(prompt).toContain('Video format: 16:9')
    expect(prompt).toContain("Publisher's direction: moody")
  })
  it('includes the current shot list and instruction when revising', () => {
    const prompt = buildBriefPrompt(facts, { format: '1:1', current: brief, instruction: 'start with page 1' })
    expect(prompt).toContain(JSON.stringify(brief))
    expect(prompt).toContain("Publisher's instruction: start with page 1")
  })
})

describe('fallbackBrief', () => {
  it('is valid and uses the first page when there is one', () => {
    const b = fallbackBrief(facts)
    expect(aiVideoBriefSchema.safeParse(b).success).toBe(true)
    expect(b.shots.map((s) => s.sourceImage)).toEqual(['cover', 'page-1'])
  })
})

describe('generateAiVideoBrief', () => {
  it('replaces images the book does not have with the cover', async () => {
    vi.mocked(generateStructured).mockResolvedValue({ data: brief, source: 'ai' })
    const result = await generateAiVideoBrief(facts, { format: '16:9' })
    expect(result.data.shots[0].sourceImage).toBe('cover')
  })
  it('keeps the current brief when the AI call fails during a revision', async () => {
    vi.mocked(generateStructured).mockImplementation(async (o: any) => ({ data: o.fallback(), source: 'fallback' }))
    const current = { ...brief, shots: [{ ...brief.shots[0], sourceImage: 'cover' }] }
    const result = await generateAiVideoBrief(facts, { format: '16:9', current, instruction: 'x' })
    expect(result.source).toBe('fallback')
    expect(result.data).toEqual(current)
  })
})
