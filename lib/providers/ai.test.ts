import { describe, it, expect, afterEach } from 'vitest'
import { getAdCopyModel } from './ai'

const original = process.env.OPENROUTER_MODEL
afterEach(() => {
  if (original === undefined) delete process.env.OPENROUTER_MODEL
  else process.env.OPENROUTER_MODEL = original
})

describe('getAdCopyModel', () => {
  it('falls back to the default model when OPENROUTER_MODEL is unset', () => {
    delete process.env.OPENROUTER_MODEL
    expect(getAdCopyModel().modelId).toBe('anthropic/claude-sonnet-5')
  })

  it('reads OPENROUTER_MODEL when set', () => {
    process.env.OPENROUTER_MODEL = 'openai/gpt-5'
    expect(getAdCopyModel().modelId).toBe('openai/gpt-5')
  })
})
