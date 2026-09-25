import { describe, it, expect, afterEach } from 'vitest'
import { estimateDuration, synthesizeChapterAudio, concatenateChapters } from './tts'

const originalFetch = global.fetch
const originalFishKey = process.env.FISH_AUDIO_API_KEY

afterEach(() => {
  global.fetch = originalFetch
  if (originalFishKey === undefined) delete process.env.FISH_AUDIO_API_KEY
  else process.env.FISH_AUDIO_API_KEY = originalFishKey
})

describe('audiobook tts engine', () => {
  it('estimates narration duration based on word count and pacing', () => {
    // 150 words at 1.0x should be ~60 seconds
    const words = Array(150).fill('word').join(' ')
    const duration = estimateDuration(words, 1.0)
    expect(duration).toBe(60)

    // At 1.2x pacing, it should be shorter
    const fastDuration = estimateDuration(words, 1.2)
    expect(fastDuration).toBeLessThan(60)
  })

  it('synthesizes chapter audio and returns audioBuffer with duration', async () => {
    const result = await synthesizeChapterAudio({
      text: 'This is a brief chapter test to verify audio generation.',
      chapterTitle: 'Chapter 1',
      ttsProvider: 'standard',
      voiceModel: 'warm-literary',
      voicePacing: 1.0,
      audioFormat: 'mp3',
    })

    expect(result.audioBuffer).toBeInstanceOf(Buffer)
    expect(result.audioBuffer.length).toBeGreaterThan(0)
    expect(result.durationSec).toBeGreaterThan(0)
    expect(result.mimeType).toBe('audio/mpeg')
    // The 'standard' engine never calls a real provider, so it must be
    // reported as fallback (the caller must not charge for it).
    expect(result.source).toBe('fallback')
  })

  it('reports source: fallback when the configured provider has no API key', async () => {
    delete process.env.FISH_AUDIO_API_KEY
    const result = await synthesizeChapterAudio({
      text: 'A chapter with no provider key configured.',
      ttsProvider: 'fishaudio',
      voiceModel: 'warm-literary',
      voicePacing: 1.0,
      audioFormat: 'mp3',
    })
    expect(result.source).toBe('fallback')
  })

  it('reports source: fallback when the provider call fails', async () => {
    process.env.FISH_AUDIO_API_KEY = 'test-key'
    global.fetch = (async () => new Response('error', { status: 500 })) as never
    const result = await synthesizeChapterAudio({
      text: 'A chapter whose provider call errors out.',
      ttsProvider: 'fishaudio',
      voiceModel: 'warm-literary',
      voicePacing: 1.0,
      audioFormat: 'mp3',
    })
    expect(result.source).toBe('fallback')
  })

  it('reports source: ai when the configured provider succeeds', async () => {
    process.env.FISH_AUDIO_API_KEY = 'test-key'
    global.fetch = (async () => new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 })) as never
    const result = await synthesizeChapterAudio({
      text: 'A chapter narrated by a real provider.',
      ttsProvider: 'fishaudio',
      voiceModel: 'warm-literary',
      voicePacing: 1.0,
      audioFormat: 'mp3',
    })
    expect(result.source).toBe('ai')
    expect(result.audioBuffer.length).toBe(3)
  })

  it('concatenates chapter buffers into a full audiobook track', async () => {
    const b1 = Buffer.from([0xff, 0xfb, 0x90, 0x64])
    const b2 = Buffer.from([0xff, 0xfb, 0x90, 0x64])
    const combined = await concatenateChapters([b1, b2], 'mp3')
    expect(combined).toBeInstanceOf(Buffer)
    expect(combined.length).toBeGreaterThanOrEqual(4)
  })
})
