/**
 * OpenRouter's asynchronous video API: submit a job, poll it, download the clip.
 * The pure helpers here are also used by the browser to estimate cost.
 */
const BASE = 'https://openrouter.ai/api/v1'

export interface VideoModelInfo {
  id: string
  durations: number[]
  aspectRatios: string[]
  resolutions: string[]
  pricePerSecond: number | null
}

interface RawVideoModel {
  id?: string
  slug?: string
  supported_durations?: number[]
  supported_aspect_ratios?: string[]
  supported_resolutions?: string[]
  pricing_skus?: Record<string, string>
}

/** We buy silent image-to-video at the base resolution; pick that price. Token-priced models return null. */
export function pricePerSecond(skus?: Record<string, string>): number | null {
  if (!skus) return null
  const perSecond = Object.entries(skus).filter(
    ([key]) => key.includes('duration_seconds') && !key.includes('with_audio') && !/4k/i.test(key)
  )
  const chosen =
    perSecond.find(([key]) => key.startsWith('image_to_video')) ??
    perSecond.find(([key]) => key.includes('without_audio')) ??
    perSecond[0]
  const value = chosen ? Number(chosen[1]) : NaN
  return Number.isFinite(value) ? value : null
}

export async function getVideoModelInfo(model: string, apiKey: string): Promise<VideoModelInfo | null> {
  const res = await fetch(`${BASE}/videos/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { data?: RawVideoModel[] } | RawVideoModel[]
  const list = Array.isArray(body) ? body : body.data ?? []
  const raw = list.find((m) => (m.id ?? m.slug) === model)
  if (!raw) return null
  return {
    id: raw.id ?? raw.slug ?? model,
    durations: raw.supported_durations ?? [],
    aspectRatios: raw.supported_aspect_ratios ?? [],
    resolutions: raw.supported_resolutions ?? [],
    pricePerSecond: pricePerSecond(raw.pricing_skus),
  }
}

/** The supported duration closest to what the brief asked for. */
export function pickDuration(wanted: number, supported: number[]): number {
  if (supported.length === 0) return wanted
  return supported.reduce((best, d) => (Math.abs(d - wanted) < Math.abs(best - wanted) ? d : best))
}

/** 720p when offered: every current model supports it and it keeps a 3-shot ad affordable. */
export function pickResolution(supported: string[]): string | undefined {
  return supported.includes('720p') ? '720p' : supported[0]
}

function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return undefined
}

export async function submitVideoJob(input: {
  apiKey: string
  model: string
  prompt: string
  imageUrl: string
  durationSec: number
  aspectRatio: string
  resolution?: string
}): Promise<string> {
  const res = await fetch(`${BASE}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      duration: input.durationSec,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      generate_audio: false,
      frame_images: [{ type: 'image_url', image_url: { url: input.imageUrl }, frame_type: 'first_frame' }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown }
  if (!res.ok || !body.id) {
    throw new Error(errorMessage(body.error) ?? `The video model rejected the request (HTTP ${res.status}).`)
  }
  return body.id
}

export type VideoJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'

export async function getVideoJob(apiKey: string, id: string): Promise<{ status: VideoJobStatus; error?: string; costUsd?: number }> {
  const res = await fetch(`${BASE}/videos/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await res.json().catch(() => ({}))) as { status?: VideoJobStatus; error?: unknown; usage?: { cost?: number } }
  if (!res.ok) throw new Error(errorMessage(body.error) ?? `Could not check the video job (HTTP ${res.status}).`)
  return { status: body.status ?? 'pending', error: errorMessage(body.error), costUsd: body.usage?.cost }
}

export async function downloadVideoJob(apiKey: string, id: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/videos/${id}/content?index=0`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Could not download the generated clip (HTTP ${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}
