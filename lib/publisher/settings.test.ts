import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPublisherSettings,
  savePublisherSettings,
  defaultPublisherSettings,
  redactSettings,
  getPublisherAiCredentials,
} from './settings'

describe('Publisher Settings', () => {
  const pubA = 'test_pub_a_' + Math.random().toString(36).slice(2)
  const pubB = 'test_pub_b_' + Math.random().toString(36).slice(2)

  it('returns default publisher settings when unconfigured', async () => {
    const settings = await getPublisherSettings(pubA)
    expect(settings.publisherId).toBe(pubA)
    expect(settings.brand.name).toBe('Local Publisher Studio')
    expect(settings.metaConnector.enabled).toBe(true)
    expect(settings.metaConnector.adAccountId).toBe('act_local_849204')
  })

  it('saves and updates publisher brand and MCP connector configurations', async () => {
    const updated = await savePublisherSettings(pubA, {
      brand: {
        name: 'Meridian Press',
        tagline: 'Speculative Fiction Imprint',
        primaryColor: '#0f172a',
        accentColor: '#38bdf8',
        primaryGenres: ['Sci-Fi', 'Solarpunk'],
        voicePrompt: 'Visionary, atmospheric, and character-led.',
      },
      metaConnector: {
        enabled: true,
        adAccountId: 'act_meridian_999',
        pageId: 'meridian_books',
        instagramHandle: '@meridianpress',
        pixelId: 'pix_12345678',
        mcpServerUrl: 'http://localhost:3333/mcp/meta',
        status: 'connected',
      },
    })

    expect(updated.brand.name).toBe('Meridian Press')
    expect(updated.metaConnector.adAccountId).toBe('act_meridian_999')
    expect(updated.metaConnector.status).toBe('connected')

    // Read it back
    const readBack = await getPublisherSettings(pubA)
    expect(readBack.brand.name).toBe('Meridian Press')
    expect(readBack.metaConnector.adAccountId).toBe('act_meridian_999')
    expect(readBack.googleConnector.customerId).toBe('948-204-1839') // retained default
  })

  it('maintains publisher isolation (no cross-tenant leakage)', async () => {
    await savePublisherSettings(pubA, {
      brand: {
        name: 'Publisher A Only',
        tagline: 'Tagline A',
        primaryColor: '#111111',
        accentColor: '#222222',
        primaryGenres: ['Fiction'],
        voicePrompt: 'Tone A',
      },
    })

    const settingsB = await getPublisherSettings(pubB)
    expect(settingsB.brand.name).toBe('Local Publisher Studio')
    expect(settingsB.brand.name).not.toBe('Publisher A Only')
  })
})

describe('redactSettings', () => {
  it("never lets the publisher's key into the returned object", async () => {
    const pub = 'test_redact_' + Math.random().toString(36).slice(2)
    const saved = await savePublisherSettings(pub, {
      ai: { openRouterKey: 'sk-or-v1-supersecretvalue', model: 'openai/gpt-5' },
    })

    const redacted = redactSettings(saved)
    expect(JSON.stringify(redacted)).not.toContain('supersecretvalue')
    expect(redacted.ai).toEqual({
      hasKey: true,
      maskedKey: 'sk-or-v...alue',
      model: 'openai/gpt-5',
    })
  })

  it('reports no key rather than a masked empty string', () => {
    const redacted = redactSettings(defaultPublisherSettings('pub_x'))
    expect(redacted.ai).toEqual({ hasKey: false, maskedKey: null, model: undefined })
  })
})

describe('getPublisherAiCredentials', () => {
  it("prefers the publisher's own key and model", async () => {
    const pub = 'test_creds_' + Math.random().toString(36).slice(2)
    await savePublisherSettings(pub, { ai: { openRouterKey: 'sk-theirs', model: 'openai/gpt-5' } })

    expect(await getPublisherAiCredentials(pub)).toEqual({
      apiKey: 'sk-theirs',
      model: 'openai/gpt-5',
    })
  })

  it('reports nothing configured so the server key is used instead', async () => {
    expect(await getPublisherAiCredentials('test_creds_none')).toEqual({ apiKey: null, model: null })
  })
})
