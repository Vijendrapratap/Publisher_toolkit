import { describe, it, expect } from 'vitest'
import {
  TTS_ENGINE_OPTIONS,
  VOICE_MODELS,
  AUDIO_FORMAT_OPTIONS,
  PACING_OPTIONS,
  audiobookProjectUpdateSchema,
} from './options'

describe('audiobook options', () => {
  it('defines Fish Audio, Qwen TTS, and Standard Studio engines', () => {
    expect(TTS_ENGINE_OPTIONS.map((e) => e.key)).toEqual(['fishaudio', 'qwen', 'standard'])
  })

  it('defines 5 voice models matching genres', () => {
    expect(VOICE_MODELS.length).toBe(5)
    for (const v of VOICE_MODELS) {
      expect(v.name).toBeTruthy()
      expect(v.tone).toBeTruthy()
      expect(v.bestFor.length).toBeGreaterThan(0)
    }
  })

  it('validates project updates with audiobookProjectUpdateSchema', () => {
    const valid = audiobookProjectUpdateSchema.safeParse({
      title: 'Valid Audiobook',
      ttsProvider: 'fishaudio',
      voiceModel: 'warm-literary',
      voicePacing: 1.0,
      audioFormat: 'mp3',
    })
    expect(valid.success).toBe(true)

    const invalid = audiobookProjectUpdateSchema.safeParse({
      voicePacing: 2.5,
    })
    expect(invalid.success).toBe(false)
  })
})
