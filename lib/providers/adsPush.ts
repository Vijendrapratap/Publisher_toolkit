export type PushPlatform = 'META' | 'GOOGLE'

export interface PushReceipt {
  receiptId: string
  platform: PushPlatform
  campaignName: string
  status: 'simulated' | 'submitted'
  createdAt: string
}

const LABELS: Record<PushPlatform, string> = { META: 'Meta', GOOGLE: 'Google' }

// Real Meta Marketing API / Google Ads API push arrives with the OAuth
// connectors plan. Until then every push is simulated and says so.
export async function pushCreativeSet(input: {
  platform: PushPlatform
  bookTitle: string
  imageCount: number
}): Promise<PushReceipt> {
  return {
    receiptId: `sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    platform: input.platform,
    campaignName: `${input.bookTitle || 'Untitled book'} — ${LABELS[input.platform]} campaign`,
    status: 'simulated',
    createdAt: new Date().toISOString(),
  }
}
