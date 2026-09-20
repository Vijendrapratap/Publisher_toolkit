import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherSettings, redactSettings } from '@/lib/publisher/settings'
import { SettingsForm } from '@/components/platform/SettingsForm'

export const metadata: Metadata = {
  title: 'Studio Profile & Settings',
  description: 'Manage publisher imprint branding, buy links, and production defaults.',
}

export default async function SettingsPage() {
  const publisherId = await requireCurrentPublisherId()
  // Redacted: this object is serialised into the client component's props,
  // and it now carries the publisher's OpenRouter key.
  const settings = redactSettings(await getPublisherSettings(publisherId))

  return <SettingsForm initial={settings} />
}
