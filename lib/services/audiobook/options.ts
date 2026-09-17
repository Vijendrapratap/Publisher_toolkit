import { z } from 'zod'

export const TTS_ENGINE_OPTIONS = [
  {
    key: 'fishaudio',
    label: 'Fish Audio (Fish Speech / OpenAudio)',
    description: 'Zero-shot emotional neural speech, voice cloning & rich prosody for dramatic fiction',
    badge: 'Recommended for Fiction',
    latency: 'low',
  },
  {
    key: 'qwen',
    label: 'Qwen TTS (CosyVoice / Alibaba Audio)',
    description: 'High-fidelity expressive multi-lingual audiobook narration with natural inflection',
    badge: 'Recommended for Non-Fiction & YA',
    latency: 'low',
  },
  {
    key: 'standard',
    label: 'Standard Studio Narrator',
    description: 'Clear, crisp studio-grade neutral narration for universal audiobook distribution',
    badge: 'Universal Studio',
    latency: 'instant',
  },
] as const

export type TtsEngineKey = (typeof TTS_ENGINE_OPTIONS)[number]['key']

export const VOICE_MODELS = [
  {
    key: 'warm-literary',
    name: 'Arthur Sterling',
    gender: 'male',
    accent: 'British / Mid-Atlantic',
    tone: 'Warm, rich, measured baritone',
    bestFor: ['Literary Fiction', 'Historical Fiction', 'Classics', 'Memoir'],
    previewText: 'The old manor stood silently against the autumn twilight, its stones whispering forgotten secrets.',
  },
  {
    key: 'intimate-cinematic',
    name: 'Elena Vance',
    gender: 'female',
    accent: 'American / Crisp',
    tone: 'Intimate, nuanced, tense, suspenseful',
    bestFor: ['Thrillers', 'Psychological Suspense', 'Mystery', 'Crime'],
    previewText: 'She stepped into the hallway. The door behind her clicked shut with unnatural finality.',
  },
  {
    key: 'epic-chronicler',
    name: 'Gideon Drake',
    gender: 'male',
    accent: 'Deep resonant',
    tone: 'Majestic, commanding, mythical',
    bestFor: ['Epic Fantasy', 'Sci-Fi', 'Space Opera', 'Dark Fantasy'],
    previewText: 'Before the sundering of the realms, when dragons still cast long shadows across the obsidian peaks.',
  },
  {
    key: 'engaging-contemporary',
    name: 'Maya Lin',
    gender: 'female',
    accent: 'Contemporary American',
    tone: 'Bright, warm, engaging, articulate',
    bestFor: ['Young Adult', 'Contemporary Fiction', 'Business', 'Self-Help'],
    previewText: 'The truth about great ideas is that they rarely arrive with fanfare. They start as tiny whispers.',
  },
  {
    key: 'reflective-warmth',
    name: 'Julian Rowe',
    gender: 'male',
    accent: 'Soft Northern English',
    tone: 'Gentle, romantic, emotional, lyrical',
    bestFor: ['Romance', 'Poetry', 'Philosophy', 'Quiet Drama'],
    previewText: 'In that fleeting moment beneath the lanterns, every doubt they harbored simply melted away.',
  },
] as const

export type VoiceModelKey = (typeof VOICE_MODELS)[number]['key']

export const AUDIO_FORMAT_OPTIONS = [
  {
    key: 'mp3',
    label: 'MP3 (192 kbps)',
    description: 'Universal audiobook standard, compatible with all devices, Audible & Apple Books',
    mimeType: 'audio/mpeg',
  },
  {
    key: 'wav',
    label: 'WAV (Uncompressed 44.1kHz)',
    description: 'Lossless master tracks for broadcast and archival mastering',
    mimeType: 'audio/wav',
  },
] as const

export type AudioFormatKey = (typeof AUDIO_FORMAT_OPTIONS)[number]['key']

export const PACING_OPTIONS = [
  { key: 0.9, label: '0.9×', description: 'Atmospheric & Deliberate' },
  { key: 1.0, label: '1.0×', description: 'Natural Storyteller' },
  { key: 1.1, label: '1.1×', description: 'Engaging & Paced' },
  { key: 1.2, label: '1.2×', description: 'Brisk & Modern' },
] as const

export const audiobookProjectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    ttsProvider: z.enum(['fishaudio', 'qwen', 'standard']),
    voiceModel: z.string().trim().max(100),
    voicePacing: z.number().min(0.7).max(1.5),
    audioFormat: z.enum(['mp3', 'wav']),
    sampleAudioUrl: z.string().url().nullable().optional(),
    chapters: z
      .array(
        z.object({
          id: z.string().optional(),
          chapterNumber: z.number().int().positive(),
          title: z.string().trim().max(200),
          content: z.string().trim().min(1, 'Chapter content is required'),
        })
      )
      .optional(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export type AudiobookProjectUpdateInput = z.infer<typeof audiobookProjectUpdateSchema>
