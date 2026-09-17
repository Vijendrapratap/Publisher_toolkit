import { describe, it, expect, beforeEach } from 'vitest'
import { getPublisherSettings, savePublisherSettings, defaultPublisherSettings } from './settings'

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
