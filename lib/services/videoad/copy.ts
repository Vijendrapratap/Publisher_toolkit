import { z } from 'zod'
import { generateStructured, generateAiImage, type AiCredentials, type AiResult } from '@/lib/providers/ai'
import { getPreset, type AdPreset } from './presets'

/**
 * The claims the ad makes. These are the whole message: the ad autoplays muted
 * in a small tile, so if a line is vague or too long to read, the ad fails.
 */
export const adScriptSchema = z.object({
  headline: z
    .string()
    .min(4)
    .max(48)
    .describe('The single strongest reason to buy. Under 6 words. No title, no author name.'),
  benefits: z
    .array(z.string().min(3).max(26).describe('A concrete, checkable claim in 2-4 words'))
    .min(2)
    .max(4),
  ctaText: z.string().min(3).max(24).describe('An action, e.g. GET YOUR COPY TODAY'),
})
export type AdScript = z.infer<typeof adScriptSchema>

export interface AdScriptFacts {
  title: string
  author?: string | null
  blurb?: string | null
  /** Amazon "About this item" bullets — the best source of real claims. */
  bullets?: string[] | null
  categories?: string[] | null
  printLength?: number | null
  rating?: number | null
  reviewCount?: number | null
}

const SYSTEM = `You write the on-screen text for Amazon Sponsored Brands video ads for books.

How these ads are watched, which decides everything you write:
- They autoplay MUTED in a tile about 300 pixels wide, beside other ads.
- Most people see the first two seconds and nothing else.
- Every word is read, not heard. Long lines are not read at all.

Rules you never break:
- Lead with what the reader gets, never with the book's title or the author's name.
- Every benefit must be a concrete, checkable property of THIS book — page count, print size, puzzle count, age range, what is included. Never "captivating", "a must-read", "perfect gift", "hours of fun" unless the source states it.
- Never invent an award, a ranking, a bestseller status, a review quote or a number. If the facts do not support a claim, write a plainer one.
- Benefits are 2-4 words. They are labels on a product, not sentences. No trailing punctuation.
- Write in the language of the source material.
- Headline and benefits must not repeat the same claim.`

function sampleScript(facts: AdScriptFacts, preset: AdPreset): AdScript {
  const benefits = [...preset.defaultBenefits]
  if (facts.printLength) benefits.unshift(`${facts.printLength} PAGES`)

  return {
    headline: facts.blurb?.split(/[.!?]/)[0]?.trim().slice(0, 48) || facts.title.slice(0, 48),
    benefits: benefits.slice(0, 3),
    ctaText: preset.cta,
  }
}

export async function generateAdScript(
  facts: AdScriptFacts,
  presetKey: string,
  credentials?: AiCredentials
): Promise<AiResult<AdScript>> {
  const preset = getPreset(presetKey)

  const prompt = [
    `Book: ${facts.title}`,
    facts.author ? `Author: ${facts.author}` : null,
    `Ad style: ${preset.label} — ${preset.description}`,
    facts.categories?.length ? `Amazon categories: ${facts.categories.join(', ')}` : null,
    facts.printLength ? `Page count: ${facts.printLength}` : null,
    facts.rating && facts.reviewCount
      ? `Customer rating: ${facts.rating} from ${facts.reviewCount} ratings`
      : null,
    facts.bullets?.length
      ? `Publisher's own bullets (prefer these — they are verified):\n- ${facts.bullets.join('\n- ')}`
      : null,
    facts.blurb ? `Description: ${facts.blurb.slice(0, 1200)}` : null,
    '',
    `Write ${preset.beats.includes('benefits') ? '3' : '2'} benefits.`,
  ]
    .filter(Boolean)
    .join('\n')

  return generateStructured({
    label: 'video-ad-script',
    schema: adScriptSchema,
    system: SYSTEM,
    prompt,
    credentials,
    temperature: 0.7,
    timeoutMs: 30_000,
    fallback: () => sampleScript(facts, preset),
  })
}

/**
 * Photoreal backdrop for the ad.
 *
 * The prompt deliberately asks for an empty surface with no book and no text:
 * the cover is composited on top, and any text the model paints would be
 * misspelled nonsense sitting under our own headline.
 */
export async function generateAdScene(
  facts: { title: string; categories?: string[] | null },
  presetKey: string,
  credentials?: AiCredentials
): Promise<Buffer | null> {
  const preset = getPreset(presetKey)
  const subject = facts.categories?.slice(0, 2).join(', ') || facts.title

  const image = await generateAiImage(
    `${preset.scenePrompt}. Mood and subject matter suited to: ${subject}. Photographic, editorial product-photography lighting, no lettering of any kind anywhere in the image.`,
    { credentials, timeoutMs: 60_000 }
  )
  return image?.buffer ?? null
}
