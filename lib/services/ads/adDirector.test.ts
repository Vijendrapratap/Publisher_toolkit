import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/ai', () => ({
  generateStructured: vi.fn(),
  generateAiImage: vi.fn(),
  getVisionModelName: () => 'google/gemini-3.8-flash',
}))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })) }))

import { generateAiImage, generateStructured } from '@/lib/providers/ai'
import { DIRECTOR_SYSTEM, buildDirectorPrompt, directAd, drawSetting, type DirectorFacts } from './adDirector'
import { fixedStoryboard, storyboardSchema } from './storyboard'
import { presetStyle } from './videoSpec'

const style = presetStyle('cinematic')
const facts: DirectorFacts = {
  title: 'Murder at Thornwick Mill',
  author: 'Ruby Fenwick',
  blurb: 'A murder mystery told through 120 word searches.',
  bullets: ['120 cases, one per page'],
  categories: ['Word Search'],
  printLength: 130,
  pageCount: 2,
  cta: 'Get your copy',
}
const images = [
  { label: 'cover', data: Buffer.from('c'), mediaType: 'image/png' },
  { label: 'page 1', data: Buffer.from('1'), mediaType: 'image/png' },
]
const options = { format: '16:9' as const, lengthSec: 20, mood: 'suspenseful', style }

beforeEach(() => {
  vi.mocked(generateStructured).mockReset()
  vi.mocked(generateAiImage).mockReset()
})

describe('DIRECTOR_SYSTEM', () => {
  it('carries the rules that make the reference ads work', () => {
    for (const rule of ['sound off', 'Use only numbers and claims', '7 words', 'end card', 'No text, no book']) {
      expect(DIRECTOR_SYSTEM).toContain(rule)
    }
  })
})

describe('buildDirectorPrompt', () => {
  it('lists the facts, the attached images in order, and the target length', () => {
    const prompt = buildDirectorPrompt(facts, images, options)
    expect(prompt).toContain('Title: Murder at Thornwick Mill')
    expect(prompt).toContain('Print length: 130 pages')
    expect(prompt).toContain('Images attached, in this order: cover, page 1')
    expect(prompt).toContain('Inside pages you can show: 1 to 2')
    expect(prompt).toContain('about 20 seconds')
  })
  it('includes the current storyboard and the instruction when revising', () => {
    const current = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    const prompt = buildDirectorPrompt(facts, images, { ...options, current, instruction: 'make it spookier' })
    expect(prompt).toContain(JSON.stringify(current))
    expect(prompt).toContain('make it spookier')
  })
})

describe('directAd', () => {
  it('asks the vision model with the images and returns a sanitized storyboard', async () => {
    vi.mocked(generateStructured).mockResolvedValue({
      source: 'ai',
      data: {
        theme: { settingPrompt: 'library desk', palette: { bg: '#123456', ink: '#ffffff', accent: '#c8a24a' }, font: 'playfair', particles: 'dust', cornerCover: false },
        beats: [
          { kind: 'hook', text: 'A miller is dead.', side: 'left', seconds: 3 },
          { kind: 'pageZoom', page: 5, seconds: 3 },
          { kind: 'endCard', title: 'Murder at Thornwick Mill', cta: 'Get your copy', seconds: 3 },
        ],
      },
    } as never)
    const result = await directAd(facts, images, options)
    const call = vi.mocked(generateStructured).mock.calls[0][0]
    expect(call.model).toBe('google/gemini-3.8-flash')
    expect(call.images).toEqual(images.map(({ data, mediaType }) => ({ data, mediaType })))
    expect(result.source).toBe('ai')
    expect(storyboardSchema.safeParse(result.data).success).toBe(true)
    expect(result.data.beats.some((b) => b.kind === 'pageZoom')).toBe(false) // page 5 does not exist
  })

  it('keeps the current storyboard when a revision fails', async () => {
    const current = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    vi.mocked(generateStructured).mockImplementation(async (o: any) => ({ source: 'fallback', data: o.fallback() }))
    const result = await directAd(facts, images, { ...options, current })
    expect(result.source).toBe('fallback')
    expect(result.data.beats).toEqual(current.beats)
  })
})

describe('drawSetting', () => {
  it('draws the setting in the video’s shape and stores it under the publisher', async () => {
    vi.mocked(generateAiImage).mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/png', dataUri: '' })
    const url = await drawSetting('a library desk at night', '9:16', 'pub_1')
    expect(vi.mocked(generateAiImage).mock.calls[0][0]).toMatch(/Tall portrait frame.*No text/s)
    expect(url).toMatch(/^\/api\/files\/ads\/pub_1\/settings\/.+\.png$/)
  })
  it('returns null when nothing could be drawn', async () => {
    vi.mocked(generateAiImage).mockResolvedValue(null)
    expect(await drawSetting('x', '16:9', 'pub_1')).toBeNull()
    expect(await drawSetting('', '16:9', 'pub_1')).toBeNull()
  })
})
