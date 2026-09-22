import { describe, it, expect } from 'vitest'
import {
  MUSIC_TRACKS,
  SCRIPT_LIMITS,
  adVideoSpecSchema,
  bookVideoSource,
  clip,
  defaultVideoSpec,
  musicUrl,
  presetStyle,
  readVideoSpec,
  resolveMusic,
  videoDimensions,
  videoDurationInFrames,
} from './videoSpec'

describe('defaultVideoSpec', () => {
  it('builds a valid spec from what the publisher typed, without AI', () => {
    const spec = defaultVideoSpec({
      title: 'Learning RAG',
      blurb: 'Build retrieval systems that work. From embeddings to evals. Third sentence here.',
      hook: '',
      cta: 'AVAILABLE NOW • GET YOUR COPY TODAY',
      style: 'scifi',
      format: '9:16',
      length: '15s',
      mood: 'epic',
    })
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
    expect(spec.script.hook).toBe('Learning RAG')
    expect(spec.script.storyLine).toBe('Build retrieval systems that work. From embeddings to evals.')
    expect(spec.script.benefits).toEqual([])
    expect(spec.script.cta.length).toBeLessThanOrEqual(SCRIPT_LIMITS.cta)
    expect(spec.style).toEqual(presetStyle('scifi'))
    expect(spec.format).toBe('9:16')
  })

  it('falls back to safe defaults for unknown stored values', () => {
    const spec = defaultVideoSpec({ style: 'nope', format: '4:3', length: '60s' })
    expect(spec.style.preset).toBe('cinematic')
    expect(spec.format).toBe('16:9')
    expect(spec.length).toBe('15s')
    expect(spec.script.hook.length).toBeGreaterThan(0)
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
  })
})

describe('clip', () => {
  it('cuts at a word boundary within the limit', () => {
    expect(clip('one two three four', 9)).toBe('one two')
  })
  it('collapses whitespace and leaves short text alone', () => {
    expect(clip('  short   text ', 20)).toBe('short text')
  })
})

describe('adVideoSpecSchema', () => {
  const valid = defaultVideoSpec({ title: 'T' })
  it('rejects text past the limits, bad colours and too many benefits', () => {
    expect(adVideoSpecSchema.safeParse({ ...valid, script: { ...valid.script, hook: 'x'.repeat(61) } }).success).toBe(false)
    expect(
      adVideoSpecSchema.safeParse({ ...valid, style: { ...valid.style, colors: { ...valid.style.colors, accent: 'red' } } }).success
    ).toBe(false)
    expect(
      adVideoSpecSchema.safeParse({ ...valid, script: { ...valid.script, benefits: ['a', 'b', 'c', 'd', 'e'] } }).success
    ).toBe(false)
  })
})

describe('readVideoSpec', () => {
  it('uses the stored spec when it validates and the default otherwise', () => {
    const stored = defaultVideoSpec({ title: 'Stored' })
    expect(readVideoSpec(stored, { title: 'Other' }).script.hook).toBe('Stored')
    expect(readVideoSpec({ junk: true }, { title: 'Other' }).script.hook).toBe('Other')
    expect(readVideoSpec(null, { title: 'Other' }).script.hook).toBe('Other')
  })
})

describe('bookVideoSource', () => {
  it('maps the ads project columns', () => {
    expect(
      bookVideoSource({
        title: 'T', blurb: 'B', customHook: 'H', ctaText: 'C',
        videoStyle: 'fantasy', videoFormat: '1:1', videoLength: '30s', videoMood: 'epic',
      })
    ).toEqual({ title: 'T', blurb: 'B', hook: 'H', cta: 'C', style: 'fantasy', format: '1:1', length: '30s', mood: 'epic' })
  })
})

describe('timing and size', () => {
  it('derives frames and pixels from the spec', () => {
    expect(videoDurationInFrames({ length: '15s' })).toBe(450)
    expect(videoDimensions('9:16')).toEqual({ width: 1080, height: 1920 })
    expect(videoDimensions('16:9')).toEqual({ width: 1920, height: 1080 })
  })
})

describe('music', () => {
  const base = defaultVideoSpec({ title: 'T', mood: 'epic' })

  it('defaults to the library track for the mood, and specs saved before music still validate', () => {
    expect(base.music).toBeUndefined()
    expect(resolveMusic(base)).toEqual({ kind: 'library', track: 'epic' })
    expect(adVideoSpecSchema.safeParse(base).success).toBe(true)
  })

  it('maps each choice to a browser URL', () => {
    expect(musicUrl({ kind: 'library', track: 'ambient' })).toBe('/music/ambient.mp3')
    expect(musicUrl({ kind: 'upload', url: '/api/files/ads/pub_1/music/x-track.mp3', name: 'x.mp3' })).toBe('/api/files/ads/pub_1/music/x-track.mp3')
    expect(musicUrl({ kind: 'none' })).toBeNull()
  })

  it('offers one track per mood and rejects uploads from other sites', () => {
    expect(MUSIC_TRACKS.map((t) => t.key)).toEqual(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional'])
    const bad = { ...base, music: { kind: 'upload', url: 'http://evil.example/x.mp3', name: 'x' } }
    expect(adVideoSpecSchema.safeParse(bad).success).toBe(false)
  })
})
