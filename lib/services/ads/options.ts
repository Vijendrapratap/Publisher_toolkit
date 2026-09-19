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
export type TemplateKey = (typeof TEMPLATES)[number]['key']

export function getTemplate(key: string): (typeof TEMPLATES)[number] {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]
}

export const CAMPAIGN_OBJECTIVES = [
  {
    key: 'launch',
    label: 'New Release / Launch Blitz',
    badge: '✦ NEW RELEASE',
    description: 'Announce arrival, build launch week momentum',
    defaultCta: 'Order Your Copy Today',
  },
  {
    key: 'preorder',
    label: 'Pre-Order & First Edition',
    badge: '★ PRE-ORDER NOW',
    description: 'Build anticipation, exclusive first-run perks',
    defaultCta: 'Pre-Order Today',
  },
  {
    key: 'discount',
    label: 'Price Drop & 99¢ Promo',
    badge: '★ LIMITED TIME DEAL',
    description: 'Drive high-volume downloads with limited discount',
    defaultCta: 'Claim 99¢ Special Deal',
  },
  {
    key: 'review_quote',
    label: 'Critical Acclaim & Awards',
    badge: '★ 5-STAR CRITICS’ CHOICE',
    description: 'Highlight praise from reviewers and fellow authors',
    defaultCta: 'Read the Acclaimed Story',
  },
  {
    key: 'tropes',
    label: 'Tropes & Reader Aesthetic',
    badge: '✦ COMMUNITY FAVORITE',
    description: 'Target specific reader hooks, tropes and vibes',
    defaultCta: 'Start Reading Free Sample',
  },
  {
    key: 'evergreen',
    label: 'Evergreen Discovery',
    badge: '✦ BESTSELLING READ',
    description: 'Continuous backlist acquisition and reader finding',
    defaultCta: 'Get Your Copy on Amazon',
  },
] as const
export type CampaignObjectiveKey = (typeof CAMPAIGN_OBJECTIVES)[number]['key']

export function getCampaignObjective(key?: string | null): (typeof CAMPAIGN_OBJECTIVES)[number] {
  return CAMPAIGN_OBJECTIVES.find((o) => o.key === key) ?? CAMPAIGN_OBJECTIVES[0]
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
    templateKey: z.enum(['classic', 'bold', 'minimal', 'cinematic', 'fantasy', 'romance', 'parchment', 'scifi']),
    campaignName: z.string().trim().max(120),
    campaignObjective: z.enum(['launch', 'preorder', 'discount', 'review_quote', 'tropes', 'evergreen']),
    targetAudience: z.string().trim().max(300),
    customHook: z.string().trim().max(200),
    ctaText: z.string().trim().max(100),
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
