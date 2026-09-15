import { z } from 'zod'
import type { AdPlatform } from './copy'

export const PLATFORMS: { key: AdPlatform; label: string; description: string }[] = [
  { key: 'META', label: 'Meta', description: 'Facebook & Instagram feed and stories' },
  { key: 'GOOGLE', label: 'Google', description: 'Display network banners' },
  { key: 'AMAZON', label: 'Amazon', description: 'Sponsored display, downloaded for manual upload' },
]

export const TONES = [
  { key: 'literary', label: 'Literary', description: 'Evocative and story-first' },
  { key: 'punchy', label: 'Punchy', description: 'Short, urgent, scroll-stopping' },
  { key: 'bold', label: 'Bold', description: 'Big claims, big energy' },
] as const
export type CopyTone = (typeof TONES)[number]['key']

export const TEMPLATES = [
  {
    key: 'classic',
    label: 'Classic',
    description: 'Dark and elegant, cover-forward',
    palette: { background: '#1c1917', ink: '#fafaf9', accent: '#f59e0b' },
  },
  {
    key: 'bold',
    label: 'Bold',
    description: 'Saturated color that pops in a feed',
    palette: { background: '#9f1239', ink: '#ffffff', accent: '#fde68a' },
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Light, quiet, lots of breathing room',
    palette: { background: '#fafaf9', ink: '#1c1917', accent: '#78716c' },
  },
] as const
export type TemplateKey = (typeof TEMPLATES)[number]['key']

export function getTemplate(key: string): (typeof TEMPLATES)[number] {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]
}

export type ProjectStatus = 'uploaded' | 'configured' | 'generated'

export const projectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    platforms: z.array(z.enum(['META', 'GOOGLE', 'AMAZON'])).min(1, 'Choose at least one platform'),
    copyTone: z.enum(['literary', 'punchy', 'bold']),
    templateKey: z.enum(['classic', 'bold', 'minimal']),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
