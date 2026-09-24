import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPublisherSettings,
  savePublisherSettings,
  defaultPublisherSettings,
  redactSettings,
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
  it('ignores a stray `ai` key left over from a settings file written before BYOK was removed', async () => {
    const pub = 'test_stray_ai_' + Math.random().toString(36).slice(2)
    // No caller can produce this shape anymore (the type has no `ai` field),
    // but an on-disk file from before this change can still have one.
    await savePublisherSettings(pub, {
      ai: { openRouterKey: 'sk-or-v1-supersecretvalue', model: 'openai/gpt-5' },
    } as unknown as Partial<Awaited<ReturnType<typeof getPublisherSettings>>>)

    const settings = await getPublisherSettings(pub)
    expect(settings).not.toHaveProperty('ai')

    const redacted = redactSettings(settings)
    expect(redacted).not.toHaveProperty('ai')
    expect(JSON.stringify(redacted)).not.toContain('sk-or-v1-supersecretvalue')
  })

  it('returns the settings unchanged — there is nothing left to redact', () => {
    const settings = defaultPublisherSettings('pub_x')
    expect(redactSettings(settings)).toEqual(settings)
  })
})
