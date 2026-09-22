import { z } from 'zod'
import type { AdPlatform } from './copy'
import { adVideoSpecSchema } from './videoSpec'

export const PLATFORMS: { key: AdPlatform; label: string; description: string }[] = [
  { key: 'AMAZON', label: 'Amazon Ads & A+ Content', description: 'Sponsored display, KDP A+ content modules & video trailers' },
]

export const TONES = [
  { key: 'literary', label: 'Literary', description: 'Evocative and story-first' },
  { key: 'punchy', label: 'Punchy', description: 'Short, urgent, scroll-stopping' },
  { key: 'bold', label: 'Bold', description: 'Big claims, big energy' },
  { key: 'intriguing', label: 'Intriguing', description: 'Mystery hooks, secrets & cliffhangers' },
  { key: 'social', label: 'Social Proof', description: 'Reader acclaim, BookTok buzz & acclaim' },
] as const
export type CopyTone = (typeof TONES)[number]['key']

export const TEMPLATES = [
  {
    key: 'classic',
    label: 'Classic Editorial',
    description: 'Dark and elegant, cover-forward serif',
    palette: { background: '#1c1917', ink: '#fafaf9', accent: '#f59e0b', secondary: '#44403c' },
  },
  {
    key: 'bold',
    label: 'Bold Pop & Buzz',
    description: 'Saturated berry crimson, high-energy feed stopper',
    palette: { background: '#9f1239', ink: '#ffffff', accent: '#fde68a', secondary: '#e11d48' },
  },
  {
    key: 'minimal',
    label: 'Clean Minimalist',
    description: 'Bone ivory, sharp contrast, generous breathing room',
    palette: { background: '#fafaf9', ink: '#1c1917', accent: '#78716c', secondary: '#e7e5e4' },
  },
  {
    key: 'cinematic',
    label: 'Cinematic Noir',
    description: 'Obsidian vignette with neon cyan & thriller suspense',
    palette: { background: '#090d16', ink: '#f8fafc', accent: '#06b6d4', secondary: '#1e293b' },
  },
  {
    key: 'fantasy',
    label: 'Mythic Fantasy',
    description: 'Midnight royal indigo with luminous starlight gold',
    palette: { background: '#0f0d23', ink: '#fef08a', accent: '#eab308', secondary: '#2e1065' },
  },
  {
    key: 'romance',
    label: 'Velvet Romance',
    description: 'Deep burgundy wine with emotional rose gold highlights',
    palette: { background: '#240615', ink: '#fff1f2', accent: '#f43f5e', secondary: '#4c0519' },
  },
  {
    key: 'parchment',
    label: 'Vintage Parchment',
    description: 'Aged sepia paper, rich espresso ink & brass warmth',
    palette: { background: '#f5eedc', ink: '#2d1b0d', accent: '#b45309', secondary: '#e6d7be' },
  },
  {
    key: 'scifi',
    label: 'Speculative Sci-Fi',
    description: 'Deep void black with crisp neon electric accents',
    palette: { background: '#050811', ink: '#f1f5f9', accent: '#38bdf8', secondary: '#0f172a' },
  },
] as const
export type TemplateKey = (typeof TEMPLATES)[number]['key'] | (string & {})

export const CAMPAIGN_OBJECTIVES = [
  {
    key: 'launch',
    label: 'New Release / Launch Blitz',
    badge: 'NEW RELEASE',
    description: 'Announce arrival, build launch week momentum',
    defaultCta: 'Order Your Copy Today',
  },
  {
    key: 'preorder',
    label: 'Pre-Order & First Edition',
    badge: 'PRE-ORDER NOW',
    description: 'Build anticipation, exclusive first-run perks',
    defaultCta: 'Pre-Order Today',
  },
  {
    key: 'discount',
    label: 'Price Drop & 99¢ Promo',
    badge: 'LIMITED TIME DEAL',
    description: 'Drive high-volume downloads with limited discount',
    defaultCta: 'Claim 99¢ Special Deal',
  },
  {
    key: 'review_quote',
    label: 'Critical Acclaim & Awards',
    badge: "5-STAR CRITICS' CHOICE",
    description: 'Highlight praise from reviewers and fellow authors',
    defaultCta: 'Read the Acclaimed Story',
  },
  {
    key: 'tropes',
    label: 'Tropes & Reader Aesthetic',
    badge: 'COMMUNITY FAVORITE',
    description: 'Target specific reader hooks, tropes and vibes',
    defaultCta: 'Start Reading Free Sample',
  },
  {
    key: 'evergreen',
    label: 'Evergreen Discovery',
    badge: 'BESTSELLING READ',
    description: 'Continuous backlist acquisition and reader finding',
    defaultCta: 'Get Your Copy on Amazon',
  },
  {
    key: 'custom',
    label: 'Custom Campaign',
    badge: 'SPECIAL PROMO',
    description: 'Create your own campaign angle, custom badge & CTA',
    defaultCta: 'Order Your Copy Today',
  },
] as const
export type CampaignObjectiveKey = (typeof CAMPAIGN_OBJECTIVES)[number]['key'] | (string & {})

export interface CampaignObjectiveItem {
  key: string
  label: string
  badge: string
  description: string
  defaultCta: string
}

export function getCampaignObjective(key?: string | null): CampaignObjectiveItem {
  if (key && key.startsWith('custom')) {
    const parts = key.split(':')
    const badge = parts.length > 1 && parts[1]?.trim() ? decodeURIComponent(parts[1].trim()) : 'SPECIAL PROMO'
    return {
      key,
      label: 'Custom Campaign',
      badge,
      description: 'Create your own campaign angle, custom badge & CTA',
      defaultCta: 'Order Your Copy Today',
    }
  }
  return (CAMPAIGN_OBJECTIVES.find((o) => o.key === key) as CampaignObjectiveItem) ?? CAMPAIGN_OBJECTIVES[0]
}

export interface TemplatePalette {
  background: string
  ink: string
  accent: string
  secondary?: string
}

export interface TemplateItem {
  key: string
  label: string
  description: string
  palette: TemplatePalette
}

export const CUSTOM_PALETTE_PRESETS = [
  { name: 'Emerald & Gold', background: '#064e3b', ink: '#ecfdf5', accent: '#f59e0b', secondary: '#047857' },
  { name: 'Midnight Purple', background: '#2e1065', ink: '#faf5ff', accent: '#c084fc', secondary: '#581c87' },
  { name: 'Terracotta Warmth', background: '#7c2d12', ink: '#fff7ed', accent: '#fdba74', secondary: '#9a3412' },
  { name: 'Deep Navy & Coral', background: '#0f172a', ink: '#f8fafc', accent: '#f97316', secondary: '#1e293b' },
  { name: 'Dark Obsidian & Mint', background: '#111827', ink: '#f0fdf4', accent: '#34d399', secondary: '#1f2937' },
  { name: 'Crimson Velvet', background: '#4c0519', ink: '#fff1f2', accent: '#fb7185', secondary: '#881337' },
] as const

export const CUSTOM_BADGE_PRESETS = [
  'SPECIAL PROMO',
  'STAFF PICK',
  'LIMITED TIME DEAL',
  'EXCLUSIVE EDITION',
  'EDITORS CHOICE',
  'BOOK CLUB PICK',
  'BESTSELLER',
  'FREE ON KU',
] as const

export function buildCustomPaletteKey(palette: {
  background: string
  ink: string
  accent: string
  secondary?: string
}): string {
  return `custom:${palette.background}:${palette.ink}:${palette.accent}:${palette.secondary ?? '#27272a'}`
}

export function parseCustomPalette(key?: string | null): TemplatePalette {
  if (key && key.startsWith('custom')) {
    const parts = key.split(':')
    if (parts.length >= 4) {
      return {
        background: parts[1] || '#18181b',
        ink: parts[2] || '#fafafa',
        accent: parts[3] || '#38bdf8',
        secondary: parts[4] || '#27272a',
      }
    }
  }
  return { background: '#18181b', ink: '#fafafa', accent: '#38bdf8', secondary: '#27272a' }
}

export function getTemplate(key: string): TemplateItem {
  if (key && key.startsWith('custom')) {
    const palette = parseCustomPalette(key)
    return {
      key,
      label: 'Custom Palette',
      description: 'User-defined custom color aesthetic',
      palette,
    }
  }
  return (TEMPLATES.find((t) => t.key === key) as TemplateItem) ?? TEMPLATES[0]
}

export const CTA_PRESETS = [
  'Order Your Copy Today',
  'Read on Kindle & Paperback',
  'Pre-Order Today',
  'Claim 99¢ Limited Deal',
  'Start Reading Free Sample',
  'Order on Amazon Now',
  'Available in All Bookstores',
] as const

export type ProjectStatus = 'uploaded' | 'configured' | 'generated'

export const projectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    platforms: z.array(z.enum(['META', 'GOOGLE', 'AMAZON'])).min(1, 'Choose at least one platform').transform((a) => [...new Set(a)]),
    copyTone: z.enum(['literary', 'punchy', 'bold', 'intriguing', 'social']),
    templateKey: z.string().trim().max(120),
    campaignName: z.string().trim().max(120),
    campaignObjective: z.string().trim().max(120),
    targetAudience: z.string().trim().max(300),
    customHook: z.string().trim().max(200),
    ctaText: z.string().trim().max(100),
    includeVideo: z.boolean().optional(),
    videoFormat: z.enum(['16:9', '1:1', '9:16']).optional(),
    videoStyle: z.enum(['cinematic', 'fantasy', 'thriller', 'scifi', 'romance', 'minimal', 'dramatic', 'energetic']).optional(),
    videoMood: z.enum(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional']).optional(),
    videoLength: z.enum(['6s', '15s', '20s', '30s']).optional(),
    videoSpec: adVideoSpecSchema.optional(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export const adCopyUpdateSchema = z.object({
  headline: z.string().trim().max(150),
  primaryText: z.string().trim().max(500),
  description: z.string().trim().max(300),
})

export const COPY_LIMITS: Record<AdPlatform, { headline: number; primaryText: number; description: number }> = {
  META: { headline: 40, primaryText: 125, description: 90 },
  GOOGLE: { headline: 30, primaryText: 90, description: 90 },
  AMAZON: { headline: 80, primaryText: 150, description: 90 },
}
