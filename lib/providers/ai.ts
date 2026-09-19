import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Default models verified against OpenRouter API
export const DEFAULT_PROCESSING_MODEL = 'deepseek/deepseek-v4.1-flash'
export const DEFAULT_LANDING_MODEL = 'deepseek/deepseek-v4.1-flash'
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image' // Nano-Banana / Gemini Image family
export const GPT_IMAGE_MODEL = 'openai/gpt-5-image'
export const DEFAULT_VIDEO_MODEL = 'google/veo-2' // Google Veo 2 / Cinematic video preview

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

/**
 * Text & reasoning processing model powered by DeepSeek v4.1
 */
export function getProcessingModel(modelOverride?: string) {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  return openrouter(modelOverride || process.env.OPENROUTER_MODEL || DEFAULT_PROCESSING_MODEL)
}

/**
 * Ad copy generation model (defaults to DeepSeek v4.1)
 */
export function getAdCopyModel(modelOverride?: string) {
  return getProcessingModel(modelOverride)
}

/**
 * Landing page content generation model (defaults to DeepSeek v4.1)
 */
export function getLandingPageModel(modelOverride?: string) {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  return openrouter(modelOverride || process.env.OPENROUTER_LANDING_MODEL || DEFAULT_LANDING_MODEL)
}

export function getImageModelName(modelOverride?: string): string {
  return modelOverride || process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
}

export function getVideoModelName(modelOverride?: string): string {
  return modelOverride || process.env.OPENROUTER_VIDEO_MODEL || DEFAULT_VIDEO_MODEL
}

export interface GeneratedAiImage {
  buffer: Buffer
  contentType: string
  base64: string
}

/**
 * Generates high-resolution images using Nano-Banana (Gemini 2.5 Flash Image) or GPT Image models.
 */
export async function generateAiImage(
  prompt: string,
  options?: { model?: string }
): Promise<GeneratedAiImage | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model = getImageModelName(options?.model)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
      }),
    })

    if (!res.ok) {
      console.warn(`[AI Image] generation returned status ${res.status}`)
      return null
    }

    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
    const first = json.data?.[0]
    if (!first) return null

    if (first.b64_json) {
      const buffer = Buffer.from(first.b64_json, 'base64')
      return {
        buffer,
        contentType: 'image/png',
        base64: `data:image/png;base64,${first.b64_json}`,
      }
    }

    if (first.url) {
      const imgRes = await fetch(first.url)
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const contentType = imgRes.headers.get('content-type') || 'image/png'
        return {
          buffer,
          contentType,
          base64: `data:${contentType};base64,${buffer.toString('base64')}`,
        }
      }
    }

    return null
  } catch (err) {
    console.error('[AI Image] generation failed', err)
    return null
  }
}
