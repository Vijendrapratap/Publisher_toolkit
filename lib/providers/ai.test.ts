import { describe, it, expect, afterEach } from 'vitest'
import {
  getAdCopyModel,
  getLandingPageModel,
  getProcessingModel,
  getImageModelName,
  getVideoModelName,
  DEFAULT_PROCESSING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
} from './ai'

const originalModel = process.env.OPENROUTER_MODEL
const originalLanding = process.env.OPENROUTER_LANDING_MODEL

afterEach(() => {
  if (originalModel === undefined) delete process.env.OPENROUTER_MODEL
  else process.env.OPENROUTER_MODEL = originalModel

  if (originalLanding === undefined) delete process.env.OPENROUTER_LANDING_MODEL
  else process.env.OPENROUTER_LANDING_MODEL = originalLanding
})

describe('ai provider models', () => {
  it('falls back to DeepSeek v4.1 for processing and ad copy when OPENROUTER_MODEL is unset', () => {
    delete process.env.OPENROUTER_MODEL
    expect(getProcessingModel().modelId).toBe(DEFAULT_PROCESSING_MODEL)
    expect(getAdCopyModel().modelId).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('reads OPENROUTER_MODEL when set', () => {
    process.env.OPENROUTER_MODEL = 'deepseek/deepseek-chat'
    expect(getAdCopyModel().modelId).toBe('deepseek/deepseek-chat')
  })

  it('uses DeepSeek v4.1 for landing page generation', () => {
    delete process.env.OPENROUTER_LANDING_MODEL
    expect(getLandingPageModel().modelId).toBe('deepseek/deepseek-v4.1-flash')
  })

  it('defaults image model to Nano-Banana / Gemini Flash Image family', () => {
    expect(getImageModelName()).toBe(DEFAULT_IMAGE_MODEL)
  })

  it('defaults video preview model to Google Veo 2', () => {
    expect(getVideoModelName()).toBe(DEFAULT_VIDEO_MODEL)
  })
})
