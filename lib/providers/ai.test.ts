import { describe, it, expect, afterEach, vi } from 'vitest'
import { z } from 'zod'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

import { generateText } from 'ai'
import {
  generateStructured,
  getLandingPageModel,
  getProcessingModel,
  getImageModelName,
  getVideoModelName,
  isAiConfigured,
  DEFAULT_PROCESSING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
} from './ai'

const env = { ...process.env }

afterEach(() => {
  process.env = { ...env }
  vi.mocked(generateText).mockReset()
})

describe('model selection', () => {
  it('falls back to the default processing model when OPENROUTER_MODEL is unset', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    delete process.env.OPENROUTER_MODEL
    expect(getProcessingModel()?.modelId).toBe(DEFAULT_PROCESSING_MODEL)
  })

  it('reads OPENROUTER_MODEL when set', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.OPENROUTER_MODEL = 'deepseek/deepseek-chat'
    expect(getProcessingModel()?.modelId).toBe('deepseek/deepseek-chat')
  })

  it("prefers the publisher's own model over the server default", () => {
    process.env.OPENROUTER_MODEL = 'deepseek/deepseek-chat'
    expect(getProcessingModel({ apiKey: 'their-key', model: 'openai/gpt-5' })?.modelId).toBe('openai/gpt-5')
  })

  it('returns null rather than an unusable model when nothing is configured', () => {
    delete process.env.OPENROUTER_API_KEY
    expect(getProcessingModel()).toBeNull()
    expect(getLandingPageModel()).toBeNull()
    expect(isAiConfigured()).toBe(false)
  })

  it("treats a publisher's own key as configured without a server key", () => {
    delete process.env.OPENROUTER_API_KEY
    expect(isAiConfigured({ apiKey: 'their-key' })).toBe(true)
  })

  it('keeps the documented image and video defaults', () => {
    expect(getImageModelName()).toBe(DEFAULT_IMAGE_MODEL)
    expect(getVideoModelName()).toBe(DEFAULT_VIDEO_MODEL)
  })
})

describe('generateStructured', () => {
  const schema = z.object({ greeting: z.string() })
  const options = {
    label: 'test',
    schema,
    system: 'system',
    prompt: 'prompt',
    fallback: () => ({ greeting: 'sample' }),
  }

  it('returns model output tagged as ai', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    vi.mocked(generateText).mockResolvedValue({ output: { greeting: 'hello' } } as never)

    expect(await generateStructured(options)).toEqual({ data: { greeting: 'hello' }, source: 'ai' })
  })

  it('falls back and says why when the model fails', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    vi.mocked(generateText).mockRejectedValue(new Error('rate limited'))

    const result = await generateStructured(options)
    expect(result.data).toEqual({ greeting: 'sample' })
    expect(result.source).toBe('fallback')
    expect(result.reason).toBe('rate limited')
  })

  it('does not call the model at all when no key is configured', async () => {
    delete process.env.OPENROUTER_API_KEY
    const result = await generateStructured(options)

    expect(result.source).toBe('fallback')
    expect(result.reason).toBe('No AI key configured')
    expect(generateText).not.toHaveBeenCalled()
  })
})
