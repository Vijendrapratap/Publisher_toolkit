import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { localStorageRoot } from '@/lib/providers/storage'

export interface PublisherBrand {
  name: string
  tagline: string
  logoUrl?: string
  primaryColor: string
  accentColor: string
  primaryGenres: string[]
  voicePrompt: string
}

export interface RetailChannels {
  amazonUrl: string
  bookshopUrl: string
  barnesNobleUrl: string
  directStoreUrl: string
  affiliateTag?: string
}

export interface MetaConnectorConfig {
  enabled: boolean
  adAccountId: string
  pageId: string
  instagramHandle: string
  pixelId: string
  mcpServerUrl: string
  status: 'connected' | 'simulated' | 'disconnected'
}

export interface GoogleConnectorConfig {
  enabled: boolean
  customerId: string
  conversionTag: string
  mcpServerUrl: string
  status: 'connected' | 'simulated' | 'disconnected'
}

export interface PublisherSettings {
  publisherId: string
  brand: PublisherBrand
  retail: RetailChannels
  metaConnector: MetaConnectorConfig
  googleConnector: GoogleConnectorConfig
  updatedAt: string
}

export function defaultPublisherSettings(publisherId: string): PublisherSettings {
  return {
    publisherId,
    brand: {
      name: 'Local Publisher Studio',
      tagline: 'Independent Book Publishing Imprint',
      primaryColor: '#1e1b4b',
      accentColor: '#6366f1',
      primaryGenres: ['Literary Fiction', 'Sci-Fi & Fantasy'],
      voicePrompt:
        'Atmospheric, intelligent, and narrative-driven. Emphasize emotional stakes and hook the reader within the first sentence.',
    },
    retail: {
      amazonUrl: 'https://amazon.com/author/yourstudio',
      bookshopUrl: 'https://bookshop.org/shop/yourstudio',
      barnesNobleUrl: '',
      directStoreUrl: '',
      affiliateTag: '',
    },
    metaConnector: {
      enabled: true,
      adAccountId: 'act_local_849204',
      pageId: 'publisher_toolkit_books',
      instagramHandle: '@localpublisher',
      pixelId: 'pix_948201934',
      mcpServerUrl: 'http://localhost:3333/mcp/meta',
      status: 'simulated',
    },
    googleConnector: {
      enabled: true,
      customerId: '948-204-1839',
      conversionTag: 'AW-948201934/conv',
      mcpServerUrl: 'http://localhost:3333/mcp/google',
      status: 'simulated',
    },
    updatedAt: new Date().toISOString(),
  }
}

function settingsFilePath(publisherId: string): string {
  const safeId = publisherId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(localStorageRoot(), 'publishers', `${safeId}.json`)
}

export async function getPublisherSettings(publisherId: string): Promise<PublisherSettings> {
  const filePath = settingsFilePath(publisherId)
  try {
    const raw = await readFile(filePath, 'utf-8')
    // Files written before BYOK was removed may still carry an `ai` key
    // (with the publisher's OpenRouter key in it); drop it so it can never
    // reappear in the merged result.
    const { ai: _staleAi, ...parsed } = JSON.parse(raw)
    const defaults = defaultPublisherSettings(publisherId)
    return {
      ...defaults,
      ...parsed,
      brand: { ...defaults.brand, ...parsed.brand },
      retail: { ...defaults.retail, ...parsed.retail },
      metaConnector: { ...defaults.metaConnector, ...parsed.metaConnector },
      googleConnector: { ...defaults.googleConnector, ...parsed.googleConnector },
      publisherId,
    }
  } catch {
    return defaultPublisherSettings(publisherId)
  }
}

export async function savePublisherSettings(
  publisherId: string,
  updates: Partial<PublisherSettings>
): Promise<PublisherSettings> {
  const current = await getPublisherSettings(publisherId)
  const merged: PublisherSettings = {
    ...current,
    ...updates,
    brand: updates.brand ? { ...current.brand, ...updates.brand } : current.brand,
    retail: updates.retail ? { ...current.retail, ...updates.retail } : current.retail,
    metaConnector: updates.metaConnector
      ? { ...current.metaConnector, ...updates.metaConnector }
      : current.metaConnector,
    googleConnector: updates.googleConnector
      ? { ...current.googleConnector, ...updates.googleConnector }
      : current.googleConnector,
    publisherId,
    updatedAt: new Date().toISOString(),
  }

  const filePath = settingsFilePath(publisherId)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

/**
 * There is no publisher-held secret left to redact — AI generation always
 * runs on the platform key — but the settings object is still returned to
 * the browser wholesale, so everything leaving the server goes through here.
 */
export type RedactedPublisherSettings = PublisherSettings

export function redactSettings(settings: PublisherSettings): RedactedPublisherSettings {
  return settings
}
