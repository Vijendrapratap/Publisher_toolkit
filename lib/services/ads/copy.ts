import { generateText, Output } from 'ai'
import { z } from 'zod'
import { isAiConfigured } from '@/lib/providers/ai'
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

const adCopySchema = z.object({
  variants: z.array(
    z.object({
      platform: z.enum(['META', 'GOOGLE', 'AMAZON']),
      headline: z.string(),
      primaryText: z.string(),
      description: z.string(),
    })
  ),
})

async function attemptGeneration(book: BookInput, tone: CopyTone) {
  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    output: Output.object({ schema: adCopySchema }),
    prompt: `Write ad copy for a book, one variant each for Meta, Google, and Amazon ads.
Book title: ${book.title}
Author: ${book.author}
Blurb: ${book.blurb}
Tone: ${tone}
Meta: casual, hook-driven headline (<=40 chars), primary text (<=125 chars).
Google: benefit-driven headline (<=30 chars), description (<=90 chars).
Amazon: straightforward, title/author forward.`,
  })
  return output.variants
}

export async function generateAdCopy(
  book: BookInput,
  options: { tone?: CopyTone; platforms?: AdPlatform[] } = {}
): Promise<AdCopyResult[]> {
  const tone = options.tone ?? 'literary'
  const wanted = (variants: AdCopyResult[]) =>
    options.platforms?.length ? variants.filter((v) => options.platforms!.includes(v.platform)) : variants

  if (!isAiConfigured()) return wanted(sampleAdCopy(book, tone))
  try {
    return wanted(await attemptGeneration(book, tone))
  } catch {
    try {
      return wanted(await attemptGeneration(book, tone))
    } catch {
      return []
    }
  }
}
