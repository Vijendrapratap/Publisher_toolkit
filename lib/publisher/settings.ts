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

export interface AiAccount {
  /** The publisher's own OpenRouter key. Never sent to the browser. */
  openRouterKey?: string
  model?: string
}

export interface PublisherSettings {
  publisherId: string
  brand: PublisherBrand
  ai: AiAccount
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
    ai: {},
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
    const parsed = JSON.parse(raw)
    const defaults = defaultPublisherSettings(publisherId)
    return {
      ...defaults,
      ...parsed,
      brand: { ...defaults.brand, ...parsed.brand },
      retail: { ...defaults.retail, ...parsed.retail },
      metaConnector: { ...defaults.metaConnector, ...parsed.metaConnector },
      googleConnector: { ...defaults.googleConnector, ...parsed.googleConnector },
      ai: { ...parsed.ai },
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
    ai: updates.ai ? { ...current.ai, ...updates.ai } : current.ai,
    publisherId,
    updatedAt: new Date().toISOString(),
  }

  const filePath = settingsFilePath(publisherId)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

/**
 * The publisher's key must never reach the browser, and the settings object is
 * returned to it wholesale. Everything leaving the server goes through here.
 */
/** What the browser is allowed to see: the key itself never crosses. */
export type RedactedPublisherSettings = Omit<PublisherSettings, 'ai'> & {
  ai: { hasKey: boolean; maskedKey: string | null; model?: string }
}

export function redactSettings(settings: PublisherSettings): RedactedPublisherSettings {
  const key = settings.ai.openRouterKey
  return {
    ...settings,
    ai: {
      model: settings.ai.model,
      hasKey: Boolean(key),
      maskedKey: key ? `${key.slice(0, 7)}...${key.slice(-4)}` : null,
    },
  }
}

/** Credentials for an AI call made on this publisher's behalf. */
export async function getPublisherAiCredentials(
  publisherId: string
): Promise<{ apiKey?: string | null; model?: string | null }> {
  const { ai } = await getPublisherSettings(publisherId)
  return { apiKey: ai.openRouterKey ?? null, model: ai.model ?? null }
}
