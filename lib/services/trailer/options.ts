import { z } from 'zod'

export const LENGTH_OPTIONS = [
  { key: '15s', label: '15 seconds', description: 'Fast-paced teaser for Reels & Shorts', durationSec: 15 },
  { key: '30s', label: '30 seconds', description: 'Classic book trailer with blurb hook', durationSec: 30 },
  { key: '60s', label: '60 seconds', description: 'In-depth cinematic preview for YouTube', durationSec: 60 },
] as const
export type TrailerLength = (typeof LENGTH_OPTIONS)[number]['key']

export const STYLE_OPTIONS = [
  { key: 'cinematic', label: 'Cinematic', description: 'Atmospheric lighting, slow zooms, filmic grading' },
  { key: 'dramatic', label: 'Dramatic', description: 'High contrast, bold typography, intense pacing' },
  { key: 'minimal', label: 'Minimal', description: 'Clean layout, subtle motions, elegant breathing room' },
  { key: 'energetic', label: 'Energetic', description: 'Fast transitions, dynamic titles, bold colors' },
] as const
export type TrailerStyle = (typeof STYLE_OPTIONS)[number]['key']

export const MUSIC_MOOD_OPTIONS = [
  { key: 'suspenseful', label: 'Suspenseful', description: 'Deep bass, tense rhythm, mysterious ambiance' },
  { key: 'epic', label: 'Epic', description: 'Rising orchestral swell, brass, impactful drums' },
  { key: 'ambient', label: 'Ambient', description: 'Ethereal pads, acoustic gentle warmth, reflective' },
  { key: 'upbeat', label: 'Upbeat', description: 'Modern pulse, positive momentum, crisp synths' },
  { key: 'emotional', label: 'Emotional', description: 'Melodic piano, strings, moving character focus' },
] as const
export type TrailerMusicMood = (typeof MUSIC_MOOD_OPTIONS)[number]['key']

export const ASPECT_RATIO_OPTIONS = [
  { key: '9:16', label: 'Vertical (9:16)', description: 'TikTok, Instagram Reels, YouTube Shorts', width: 1080, height: 1920 },
  { key: '1:1', label: 'Square (1:1)', description: 'Instagram Feed, Facebook & LinkedIn posts', width: 1080, height: 1080 },
  { key: '16:9', label: 'Widescreen (16:9)', description: 'YouTube, Book Website, Landscape displays', width: 1920, height: 1080 },
] as const
export type TrailerAspectRatio = (typeof ASPECT_RATIO_OPTIONS)[number]['key']

export function getAspectRatioSpec(key: string): (typeof ASPECT_RATIO_OPTIONS)[number] {
  return ASPECT_RATIO_OPTIONS.find((a) => a.key === key) ?? ASPECT_RATIO_OPTIONS[0]
}

export function getDurationForLength(key: string): number {
  return LENGTH_OPTIONS.find((l) => l.key === key)?.durationSec ?? 30
}

export type TrailerProjectStatus = 'uploaded' | 'configured' | 'generated'

export const trailerProjectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    length: z.enum(['15s', '30s', '60s']),
    style: z.enum(['cinematic', 'dramatic', 'minimal', 'energetic']),
    musicMood: z.enum(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional']),
    aspectRatios: z
      .array(z.enum(['9:16', '1:1', '16:9']))
      .min(1, 'Select at least one aspect ratio')
      .transform((a) => [...new Set(a)]),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
