import { z } from 'zod'

export const LANDING_TEMPLATES = [
  {
    key: 'bestseller',
    label: 'Bestseller Blockbuster',
    tagline: 'High-Impact Conversion',
    description: 'Bold cinema typography, urgent social proof ticker, hero 3D cover showcase, and multiple retailer purchase buttons',
    bestFor: ['Thrillers', 'Commercial Fiction', 'Action', 'Bestsellers'],
    previewBg: '#0b0f19',
    accent: '#ef4444',
  },
  {
    key: 'editorial',
    label: 'Literary Editorial',
    tagline: 'Timeless Elegance',
    description: 'Generous typographic whitespace, exquisite serif headings, critic quotes, and in-depth author interview section',
    bestFor: ['Literary Fiction', 'Historical', 'Memoir', 'Poetry'],
    previewBg: '#181615',
    accent: '#d97706',
  },
  {
    key: 'fantasy',
    label: 'Atmospheric Lore',
    tagline: 'Mythic Immersion',
    description: 'Deep midnight aesthetic, luminous gold & violet aura glows, world-building lore preview, and enchanted parchment accents',
    bestFor: ['Epic Fantasy', 'Sci-Fi', 'Paranormal', 'Urban Fantasy'],
    previewBg: '#0f081d',
    accent: '#8b5cf6',
  },
  {
    key: 'minimal',
    label: 'Modern Indie Author',
    tagline: 'Sleek & Focused',
    description: 'Contemporary minimalist layout, interactive sample chapter reader drawer, clean retail grid, and newsletter subscription',
    bestFor: ['Non-Fiction', 'Business', 'Contemporary', 'Self-Help'],
    previewBg: '#0d1117',
    accent: '#38bdf8',
  },
  {
    key: 'romance',
    label: 'Romantic Glow',
    tagline: 'Emotional & Lyrical',
    description: 'Warm blush & rose velvet tones, character romance quotes, emotional pull-quotes, and reader community reviews',
    bestFor: ['Romance', 'New Adult', 'Romantic Comedy', 'Drama'],
    previewBg: '#1f0d1a',
    accent: '#fb7185',
  },
] as const

export type LandingTemplateKey = (typeof LANDING_TEMPLATES)[number]['key']

export const THEME_OPTIONS = [
  { key: 'matt', label: 'Matt Charcoal', description: 'Deep non-reflective dark theme with clean contrast' },
  { key: 'dark', label: 'Onyx Midnight', description: 'Deep black with neon/vivid accents' },
  { key: 'light', label: 'Classic Paper', description: 'Crisp editorial cream and warm white paper tones' },
] as const

export type LandingThemeKey = (typeof THEME_OPTIONS)[number]['key']

export const RETAILER_PRESETS = [
  { key: 'amazon', name: 'Amazon Kindle & Paperback', icon: 'amazon', defaultDomain: 'https://amazon.com/dp/' },
  { key: 'barnes', name: 'Barnes & Noble', icon: 'barnes', defaultDomain: 'https://barnesandnoble.com/w/' },
  { key: 'apple', name: 'Apple Books', icon: 'apple', defaultDomain: 'https://books.apple.com/book/' },
  { key: 'audible', name: 'Audible Audiobook', icon: 'audible', defaultDomain: 'https://audible.com/pd/' },
  { key: 'bookshop', name: 'Bookshop.org (Indie Stores)', icon: 'bookshop', defaultDomain: 'https://bookshop.org/books/' },
  { key: 'kobo', name: 'Kobo', icon: 'kobo', defaultDomain: 'https://kobo.com/ebook/' },
] as const

export const landingProjectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    subtitle: z.string().trim().max(300).nullable().optional(),
    author: z.string().trim().max(200),
    authorBio: z.string().trim().max(2000).nullable().optional(),
    synopsis: z.string().trim().max(4000).nullable().optional(),
    template: z.enum(['bestseller', 'editorial', 'fantasy', 'minimal', 'romance']),
    theme: z.enum(['matt', 'dark', 'light']),
    accentColor: z.string().trim().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
    ctaText: z.string().trim().max(100),
    retailerLinks: z
      .array(
        z.object({
          retailer: z.string().trim().min(1),
          url: z.string().trim().url('Must be a valid URL'),
        })
      )
      .optional(),
    reviews: z
      .array(
        z.object({
          quote: z.string().trim().min(1),
          reviewer: z.string().trim().min(1),
          outlet: z.string().trim().optional(),
        })
      )
      .optional(),
    sampleChapterTitle: z.string().trim().max(200).nullable().optional(),
    sampleChapterText: z.string().trim().max(15000).nullable().optional(),
    publishedSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
      .max(80)
      .nullable()
      .optional(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export type LandingProjectUpdateInput = z.infer<typeof landingProjectUpdateSchema>
