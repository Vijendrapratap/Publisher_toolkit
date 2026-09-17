import { describe, it, expect } from 'vitest'
import { estimateDuration, synthesizeChapterAudio, concatenateChapters } from './tts'

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
  })

  it('concatenates chapter buffers into a full audiobook track', async () => {
    const b1 = Buffer.from([0xff, 0xfb, 0x90, 0x64])
    const b2 = Buffer.from([0xff, 0xfb, 0x90, 0x64])
    const combined = await concatenateChapters([b1, b2], 'mp3')
    expect(combined).toBeInstanceOf(Buffer)
    expect(combined.length).toBeGreaterThanOrEqual(4)
  })
})
