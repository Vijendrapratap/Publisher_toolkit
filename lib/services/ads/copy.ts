import { generateText, Output } from 'ai'
import { z } from 'zod'
import { isAiConfigured } from '@/lib/providers/ai'
import { sampleAdCopy } from './sampleCopy'

export type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'

export interface AdCopyResult {
  platform: AdPlatform
  headline: string
  primaryText: string
  description: string
}

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

async function attemptGeneration(book: { title: string; author: string; blurb: string }) {
  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    output: Output.object({ schema: adCopySchema }),
    prompt: `Write ad copy for a book, one variant each for Meta, Google, and Amazon ads.
Book title: ${book.title}
Author: ${book.author}
Blurb: ${book.blurb}
Meta: casual, hook-driven headline (<=40 chars), primary text (<=125 chars).
Google: benefit-driven headline (<=30 chars), description (<=90 chars).
Amazon: straightforward, title/author forward.`,
  })
  return output.variants
}

export async function generateAdCopy(book: { title: string; author: string; blurb: string }): Promise<AdCopyResult[]> {
  if (!isAiConfigured()) return sampleAdCopy(book)
  try {
    return await attemptGeneration(book)
  } catch {
    try {
      return await attemptGeneration(book)
    } catch {
      return []
    }
  }
}
