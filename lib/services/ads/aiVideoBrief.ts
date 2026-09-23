import { generateStructured, type AiCredentials, type AiResult } from '@/lib/providers/ai'
import {
  BRIEF_SYSTEM,
  aiVideoBriefSchema,
  buildBriefPrompt,
  fallbackBrief,
  imageKeys,
  sanitizeBrief,
  type AiVideoBrief,
  type BriefFacts,
} from './aiVideoBriefSchema'

export async function generateAiVideoBrief(
  facts: BriefFacts,
  options: { current?: AiVideoBrief; instruction?: string; format: string },
  credentials?: AiCredentials
): Promise<AiResult<AiVideoBrief>> {
  const result = await generateStructured({
    label: options.current ? 'ai-video-brief-revise' : 'ai-video-brief',
    schema: aiVideoBriefSchema,
    system: BRIEF_SYSTEM,
    prompt: buildBriefPrompt(facts, options),
    credentials,
    temperature: 0.8,
    timeoutMs: 45_000,
    // A failed revision must not throw away what the publisher already has.
    fallback: () => options.current ?? fallbackBrief(facts),
  })
  return { ...result, data: sanitizeBrief(result.data, imageKeys(facts.pageCount)) }
}
