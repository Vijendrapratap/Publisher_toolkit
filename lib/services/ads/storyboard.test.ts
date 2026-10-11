import { describe, it, expect } from 'vitest'
import {
  TRANSITION_FRAMES,
  beatStartFrames,
  fitToLength,
  fixedStoryboard,
  ownsStoredFile,
  pagesUsed,
  sanitizeStoryboard,
  storyboardDurationInFrames,
  storyboardSchema,
  tidyLine,
  type Beat,
  type StoryboardDraft,
} from './storyboard'
import { adVideoSpecSchema, defaultVideoSpec, presetStyle } from './videoSpec'

const style = presetStyle('cinematic')
const ctx = { pageCount: 3, title: 'Murder at Thornwick Mill', cta: 'Get your copy', lengthSec: 20, style }
const draft = (beats: StoryboardDraft['beats'], theme: Partial<StoryboardDraft['theme']> = {}): StoryboardDraft => ({
  theme: { settingPrompt: 'a library desk at night', palette: { bg: '#1b2a1f', ink: '#f4ead5', accent: '#c8a24a' }, font: 'playfair', particles: 'dust', cornerCover: false, ...theme },
  beats,
})

describe('tidyLine', () => {
  it('keeps a line that already fits, including its own line break', () => {
    expect(tidyLine('It was not.\nAnd it did not stop.')).toBe('It was not.\nAnd it did not stop.')
  })
  it('rewraps a long line into two lines of at most 7 words', () => {
    const out = tidyLine('one two three four five six seven eight nine ten')
    expect(out.split('\n')).toEqual(['one two three four five', 'six seven eight nine ten'])
  })
  it('drops words past 14 and keeps it under 60 characters', () => {
    const out = tidyLine('Extraordinary sentences contain wonderfully lengthy vocabulary everywhere imaginable today alright friends okay sure yes more')
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.split('\n').every((l) => l.split(' ').length <= 7)).toBe(true)
  })
})

describe('sanitizeStoryboard', () => {
  it('turns a reasonable draft into a valid storyboard', () => {
    const sb = sanitizeStoryboard(
      draft([
        { kind: 'hook', text: 'A miller is dead.', side: 'left', seconds: 3 },
        { kind: 'pageZoom', text: '120 cases. One per page.', page: 2, focus: { x: 0.4, y: 0.3, zoom: 1.8 }, seconds: 3 },
        { kind: 'endCard', title: 'Murder at Thornwick Mill', subtitle: 'Book One', cta: 'Get your copy', seconds: 3.5 },
      ]),
      ctx
    )
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats.map((b) => b.kind)).toEqual(['hook', 'pageZoom', 'endCard'])
  })

  it('repairs out-of-bounds output instead of rejecting it', () => {
    const beats: StoryboardDraft['beats'] = [
      { kind: 'proof', text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen', seconds: 10 },
      { kind: 'endCard', title: 'Too early', cta: 'Buy', seconds: 3 },
      { kind: 'pageZoom', page: 9, seconds: 3 },
      { kind: 'bookOpen', page: 0, seconds: 3 },
      ...Array.from({ length: 12 }, () => ({ kind: 'audience' as const, text: 'For puzzle fans', seconds: 1 })),
    ]
    const sb = sanitizeStoryboard(draft(beats, { palette: { bg: 'navy', ink: '#fff', accent: '#c8a24a' }, font: 'comic-sans', particles: 'confetti' }), ctx)
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats[0].kind).toBe('hook') // no hook/titleCard first, so one is added
    expect(sb.beats.at(-1)!.kind).toBe('endCard')
    expect(sb.beats.filter((b) => b.kind === 'endCard')).toHaveLength(1)
    expect(sb.beats.length).toBeLessThanOrEqual(9)
    expect(sb.beats.some((b) => b.kind === 'pageZoom' || b.kind === 'bookOpen')).toBe(false)
    expect(sb.theme.palette.bg).toBe(style.colors.bgTo)
    expect(sb.theme.font).toBe(style.font)
    expect(sb.theme.particles).toBe('none')
  })

  it('never keeps a page beat when the book has no pages', () => {
    const sb = sanitizeStoryboard(
      draft([
        { kind: 'titleCard', text: 'The camp called it an accident.', seconds: 3 },
        { kind: 'bookOpen', page: 1, seconds: 3 },
        { kind: 'proof', text: '20 puzzles', page: 1, seconds: 3 },
        { kind: 'endCard', title: 'T', cta: 'Get it', seconds: 3 },
      ]),
      { ...ctx, pageCount: 0 }
    )
    expect(pagesUsed(sb)).toEqual([])
  })
})

describe('timing', () => {
  const beats: Beat[] = [
    { kind: 'hook', text: 'A', side: 'left', seconds: 3 },
    { kind: 'audience', text: 'B', seconds: 2 },
    { kind: 'endCard', title: 'T', cta: 'C', seconds: 3 },
  ]
  it('subtracts one transition per join', () => {
    expect(storyboardDurationInFrames(beats)).toBe(90 + 60 + 90 - 2 * TRANSITION_FRAMES)
    expect(beatStartFrames(beats)).toEqual([0, 90 - TRANSITION_FRAMES, 90 + 60 - 2 * TRANSITION_FRAMES])
  })
  it('stretches the body towards the chosen length and keeps each beat within 2–4 s', () => {
    const fitted = fitToLength(beats, 15)
    expect(fitted.at(-1)).toEqual(beats.at(-1))
    expect(fitted.slice(0, -1).every((b) => b.seconds >= 2 && b.seconds <= 4)).toBe(true)
    expect(storyboardDurationInFrames(fitted)).toBeGreaterThan(storyboardDurationInFrames(beats))
  })
})

describe('fixedStoryboard', () => {
  it('uses only what the publisher gave: title, blurb, bullets, pages', () => {
    const sb = fixedStoryboard({ title: 'Jumbo Autumn Word Search', blurb: 'Large print puzzles for fall. More inside.', bullets: ['100 large-print puzzles'], pageCount: 3, cta: 'Get your copy', lengthSec: 20, style })
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats.map((b) => b.kind)).toEqual(['hook', 'titleCard', 'bookOpen', 'pageZoom', 'pageZoom', 'audience', 'endCard'])
    expect(pagesUsed(sb)).toEqual([1, 2, 3])
  })
  it('still makes a valid video with no pages, blurb or bullets', () => {
    const sb = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Get it', lengthSec: 15, style })
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(pagesUsed(sb)).toEqual([])
  })
})

describe('videoSpec with a storyboard', () => {
  it('accepts a spec that carries a storyboard and one without', () => {
    const spec = defaultVideoSpec({ title: 'T' })
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
    const storyboard = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    expect(adVideoSpecSchema.safeParse({ ...spec, storyboard }).success).toBe(true)
  })
})

describe('ownsStoredFile', () => {
  it('accepts only this publisher’s own files, locally or on Blob', () => {
    expect(ownsStoredFile('/api/files/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(true)
    expect(ownsStoredFile('https://abc123.public.blob.vercel-storage.com/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(true)
    expect(ownsStoredFile('/api/files/ads/pub_2/settings/a.png', 'ads/pub_1/settings/')).toBe(false)
    expect(ownsStoredFile('https://evil.example/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(false)
    expect(ownsStoredFile('/api/files/ads/pub_1/settings/../../pub_2/x.png', 'ads/pub_1/settings/')).toBe(false)
  })
})
