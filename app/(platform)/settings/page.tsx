import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherSettings } from '@/lib/publisher/settings'
import { SettingsForm } from '@/components/platform/SettingsForm'

export const metadata: Metadata = {
  title: 'Studio Profile & Connectors',
  description: 'Manage publisher imprint branding, buy links, and Meta & Google Ads MCP connectors.',
}

export default async function SettingsPage() {
  const publisherId = await requireCurrentPublisherId()
  const settings = await getPublisherSettings(publisherId)

  return <SettingsForm initial={settings} />
}
