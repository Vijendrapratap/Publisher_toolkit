import { z } from 'zod'
import { generateStructured, type AiCredentials, type AiResult } from '@/lib/providers/ai'
import { sampleAdCopy } from './sampleCopy'
import type { CopyTone } from './options'

export type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'

export interface AdCopyResult {
  platform: AdPlatform
  headline: string
  primaryText: string
  description: string
}

type BookInput = { title: string; author: string; blurb: string }

export interface AdCopyOptions {
  tone?: CopyTone
  platforms?: AdPlatform[]
  campaignObjective?: string
  targetAudience?: string
  customHook?: string
  ctaText?: string
  credentials?: AiCredentials
}

// Character caps are the real ad platforms' limits. Stating them in the schema
// as well as the prompt means an over-long headline is a validation failure the
// model retries, not something a publisher discovers after upload.
const adCopySchema = z.object({
  variants: z
    .array(
      z.object({
        platform: z.enum(['META', 'GOOGLE', 'AMAZON']),
        headline: z.string().min(1).max(60).describe('Scroll-stopping, no quotes, no trailing period'),
        primaryText: z.string().min(1).max(200).describe('The body of the ad'),
        description: z.string().min(1).max(120).describe('The supporting line beneath the headline'),
      })
    )
    .min(1),
})

const SYSTEM = `You are a direct-response copywriter who sells books for a living.

Rules you never break:
- Lead with the reader's payoff or an open loop, never with "This book is".
- Concrete nouns over adjectives. No "captivating", "gripping", "must-read", "page-turner".
- Never invent awards, review quotes, sales figures or endorsements.
- Match each platform's conventions: Meta is casual and hook-first (headline <=40 chars, primary text <=125); Google is benefit-first and literal (headline <=30 chars, description <=90); Amazon is title-and-author forward and plain.
- Write one variant per requested platform and no others.`

function buildPrompt(book: BookInput, tone: CopyTone, options: AdCopyOptions, platforms: AdPlatform[]): string {
  const context = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    `Blurb: ${book.blurb || '(none supplied — work from the title alone and stay generic rather than inventing plot)'}`,
    `Tone: ${tone}`,
    `Platforms to write for: ${platforms.join(', ')}`,
    options.campaignObjective ? `Campaign objective: ${options.campaignObjective}` : null,
    options.targetAudience ? `Target reader: ${options.targetAudience}` : null,
    options.customHook ? `Angle the publisher wants: ${options.customHook}` : null,
    options.ctaText ? `Call to action to work toward: ${options.ctaText}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `Write ad copy for this book.\n\n${context}`
}

export async function generateAdCopy(
  book: BookInput,
  options: AdCopyOptions = {}
): Promise<AiResult<AdCopyResult[]>> {
  const tone = options.tone ?? 'literary'
  const platforms = options.platforms?.length ? options.platforms : (['META', 'GOOGLE', 'AMAZON'] as AdPlatform[])
  const onlyWanted = (variants: AdCopyResult[]) => variants.filter((v) => platforms.includes(v.platform))

  const result = await generateStructured({
    label: 'ad-copy',
    schema: adCopySchema,
    system: SYSTEM,
    prompt: buildPrompt(book, tone, options, platforms),
    credentials: options.credentials,
    temperature: 0.8,
    timeoutMs: 30_000,
    fallback: () => ({ variants: sampleAdCopy(book, tone, options) }),
  })

  return { ...result, data: onlyWanted(result.data.variants) }
}
