import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import type { ZodType } from 'zod'

export const DEFAULT_PROCESSING_MODEL = 'deepseek/deepseek-v4.1-flash'
export const DEFAULT_LANDING_MODEL = 'deepseek/deepseek-v4.1-flash'
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image'
export const DEFAULT_VIDEO_MODEL = 'google/veo-2'

/**
 * A publisher can bring their own OpenRouter account; the server key is the
 * fallback. Never read `process.env.OPENROUTER_API_KEY` directly elsewhere —
 * that skips the publisher's own key.
 */
export interface AiCredentials {
  apiKey?: string | null
  model?: string | null
}

export function resolveApiKey(credentials?: AiCredentials): string | undefined {
  return credentials?.apiKey?.trim() || process.env.OPENROUTER_API_KEY || undefined
}

export function isAiConfigured(credentials?: AiCredentials): boolean {
  return Boolean(resolveApiKey(credentials))
}

// One provider per key. The previous code built a fresh client (and its fetch
// plumbing) on every single generation call.
const providers = new Map<string, ReturnType<typeof createOpenRouter>>()

function providerFor(apiKey: string) {
  let provider = providers.get(apiKey)
  if (!provider) {
    provider = createOpenRouter({ apiKey })
    providers.set(apiKey, provider)
  }
  return provider
}

/** Returns null when nothing is configured, so callers fall back explicitly. */
export function getModel(credentials?: AiCredentials, defaultModel = DEFAULT_PROCESSING_MODEL) {
  const apiKey = resolveApiKey(credentials)
  if (!apiKey) return null
  const modelId = credentials?.model?.trim() || process.env.OPENROUTER_MODEL || defaultModel
  return providerFor(apiKey)(modelId)
}

export function getProcessingModel(credentials?: AiCredentials) {
  return getModel(credentials)
}

export function getLandingPageModel(credentials?: AiCredentials) {
  const apiKey = resolveApiKey(credentials)
  if (!apiKey) return null
  const modelId =
    credentials?.model?.trim() || process.env.OPENROUTER_LANDING_MODEL || DEFAULT_LANDING_MODEL
  return providerFor(apiKey)(modelId)
}

/** Where a piece of generated content actually came from. */
export type AiSource = 'ai' | 'fallback'

export interface AiResult<T> {
  data: T
  source: AiSource
  /** Why the fallback was used, when it was. */
  reason?: string
}

export interface GenerateStructuredOptions<T> {
  /** Shows up in logs and in the `reason` a caller can surface to the user. */
  label: string
  schema: ZodType<T>
  system: string
  prompt: string
  /** Used when AI is unconfigured, times out, or returns unusable output. */
  fallback: () => T
  credentials?: AiCredentials
  model?: string
  temperature?: number
  maxOutputTokens?: number
  timeoutMs?: number
}

/**
 * The single way this app asks a model for structured content.
 *
 * The schema is enforced by the provider *and* validated on the way back, so a
 * malformed response fails loudly into `source: 'fallback'` instead of being
 * hand-parsed. Callers must branch on `source` — silently serving canned
 * sample content as if it were the user's book is the bug this exists to stop.
 */
export async function generateStructured<T>(
  options: GenerateStructuredOptions<T>
): Promise<AiResult<T>> {
  const model = options.model
    ? getModel({ ...options.credentials, model: options.model })
    : getModel(options.credentials)

  if (!model) {
    return { data: options.fallback(), source: 'fallback', reason: 'No AI key configured' }
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: options.schema }),
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens,
      abortSignal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    })
    return { data: output, source: 'ai' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[ai:${options.label}] falling back to sample content — ${reason}`)
    return { data: options.fallback(), source: 'fallback', reason }
  }
}

export function getImageModelName(credentials?: AiCredentials): string {
  return credentials?.model?.trim() || process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
}

export function getVideoModelName(credentials?: AiCredentials): string {
  return credentials?.model?.trim() || process.env.OPENROUTER_VIDEO_MODEL || DEFAULT_VIDEO_MODEL
}

export interface GeneratedAiImage {
  buffer: Buffer
  contentType: string
  dataUri: string
}

/** Returns null rather than throwing: every caller treats imagery as optional. */
export async function generateAiImage(
  prompt: string,
  options?: { credentials?: AiCredentials; model?: string; timeoutMs?: number }
): Promise<GeneratedAiImage | null> {
  const apiKey = resolveApiKey(options?.credentials)
  if (!apiKey) return null

  const model = options?.model || getImageModelName(options?.credentials)
  const signal = AbortSignal.timeout(options?.timeoutMs ?? 60_000)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
      signal,
    })

    if (!res.ok) {
      console.warn(`[ai:image] generation returned status ${res.status}`)
      return null
    }

    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
    const first = json.data?.[0]
    if (!first) return null

    if (first.b64_json) {
      return {
        buffer: Buffer.from(first.b64_json, 'base64'),
        contentType: 'image/png',
        dataUri: `data:image/png;base64,${first.b64_json}`,
      }
    }

    if (!first.url) return null
    const imgRes = await fetch(first.url, { signal })
    if (!imgRes.ok) return null
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') || 'image/png'
    return { buffer, contentType, dataUri: `data:${contentType};base64,${buffer.toString('base64')}` }
  } catch (err) {
    console.error('[ai:image] generation failed', err)
    return null
  }
}
