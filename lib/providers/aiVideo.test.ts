import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadVideoJob, getVideoJob, getVideoModelInfo, OpenRouterHttpError, pickDuration, pickResolution, pricePerSecond, submitVideoJob } from './aiVideo'

const fetchMock = vi.fn()
beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('pricePerSecond', () => {
  it('prefers the silent image-to-video price', () => {
    expect(pricePerSecond({ duration_seconds: '0.084', duration_seconds_with_audio: '0.126', image_to_video_duration_seconds_720p: '0.084', text_to_video_duration_seconds_480p: '0.05' })).toBe(0.084)
  })
  it('uses the price without audio and ignores 4K', () => {
    expect(pricePerSecond({ duration_seconds_with_audio: '0.40', duration_seconds_without_audio: '0.20', duration_seconds_without_audio_4k: '0.40' })).toBe(0.2)
  })
  it('returns null for token-priced models', () => {
    expect(pricePerSecond({ video_tokens: '0.000007' })).toBeNull()
  })
})

describe('pickDuration / pickResolution', () => {
  it('chooses the closest supported duration', () => {
    expect(pickDuration(5, [4, 6, 8])).toBe(4)
    expect(pickDuration(7, [3, 5, 7, 10])).toBe(7)
    expect(pickDuration(5, [])).toBe(5)
  })
  it('prefers 720p', () => {
    expect(pickResolution(['1080p', '720p'])).toBe('720p')
    expect(pickResolution(['1080p'])).toBe('1080p')
  })
})

describe('getVideoModelInfo', () => {
  it('finds the model and normalises its capabilities', async () => {
    fetchMock.mockImplementation(() => json({ data: [{ id: 'kwaivgi/kling-v3.0-std', supported_durations: [3, 5], supported_aspect_ratios: ['16:9', '1:1'], supported_resolutions: ['720p'], pricing_skus: { duration_seconds: '0.084' } }] }))
    expect(await getVideoModelInfo('kwaivgi/kling-v3.0-std', 'k')).toEqual({
      id: 'kwaivgi/kling-v3.0-std', durations: [3, 5], aspectRatios: ['16:9', '1:1'], resolutions: ['720p'], pricePerSecond: 0.084,
    })
    expect(await getVideoModelInfo('missing/model', 'k')).toBeNull()
  })
})

describe('submitVideoJob', () => {
  it('sends the documented image-to-video request', async () => {
    fetchMock.mockResolvedValue(json({ id: 'job_1', status: 'pending' }, 202))
    const id = await submitVideoJob({ apiKey: 'k', model: 'm', prompt: 'p', imageUrl: 'data:image/png;base64,AA', durationSec: 5, aspectRatio: '16:9', resolution: '720p' })
    expect(id).toBe('job_1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/videos')
    expect(JSON.parse(init.body)).toEqual({
      model: 'm', prompt: 'p', duration: 5, aspect_ratio: '16:9', resolution: '720p', generate_audio: false,
      frame_images: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA' }, frame_type: 'first_frame' }],
    })
    expect(init.headers.Authorization).toBe('Bearer k')
  })
  it("surfaces the provider's error message as a typed HTTP error carrying the status", async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'aspect_ratio 1:1 is not supported' } }, 400))
    const err: unknown = await submitVideoJob({ apiKey: 'k', model: 'm', prompt: 'p', imageUrl: 'x', durationSec: 5, aspectRatio: '1:1' }).catch((e) => e)
    expect(err).toBeInstanceOf(OpenRouterHttpError)
    expect((err as OpenRouterHttpError).status).toBe(400)
    expect((err as OpenRouterHttpError).message).toBe('aspect_ratio 1:1 is not supported')
  })
})

describe('getVideoJob', () => {
  it('maps status, error and cost', async () => {
    fetchMock.mockResolvedValue(json({ id: 'job_1', status: 'completed', usage: { cost: 0.42 } }))
    expect(await getVideoJob('k', 'job_1')).toEqual({ status: 'completed', error: undefined, costUsd: 0.42 })
  })
  it('throws a typed HTTP error carrying the status on a JSON error body', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'job not found' } }, 404))
    const err: unknown = await getVideoJob('k', 'job_1').catch((e) => e)
    expect(err).toBeInstanceOf(OpenRouterHttpError)
    expect((err as OpenRouterHttpError).status).toBe(404)
    expect((err as OpenRouterHttpError).message).toBe('job not found')
  })
})

describe('downloadVideoJob', () => {
  it('downloads the clip bytes', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    expect(await downloadVideoJob('k', 'job_1')).toEqual(Buffer.from([1, 2, 3]))
  })
  it('throws a typed HTTP error carrying the status on failure', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))
    const err: unknown = await downloadVideoJob('k', 'job_1').catch((e) => e)
    expect(err).toBeInstanceOf(OpenRouterHttpError)
    expect((err as OpenRouterHttpError).status).toBe(404)
  })
})
