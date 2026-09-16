import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Verified live against https://openrouter.ai/api/v1/models on 2026-09-16.
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5'

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

// Client is constructed here, not at module load, so importing this file
// with no OPENROUTER_API_KEY (the local-mode default) never throws.
export function getAdCopyModel() {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  return openrouter(process.env.OPENROUTER_MODEL || DEFAULT_MODEL)
}
