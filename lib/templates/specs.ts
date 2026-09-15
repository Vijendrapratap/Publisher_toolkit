import type { AdPlatform } from '@/lib/ai/generateAdCopy'

export interface CreativeSizeSpec {
  key: string
  platform: AdPlatform
  width: number
  height: number
}

export const CREATIVE_SIZES: CreativeSizeSpec[] = [
  { key: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080 },
  { key: 'meta_story_1080x1920', platform: 'META', width: 1080, height: 1920 },
  { key: 'google_display_300x250', platform: 'GOOGLE', width: 300, height: 250 },
  { key: 'google_display_728x90', platform: 'GOOGLE', width: 728, height: 90 },
  { key: 'amazon_300x250', platform: 'AMAZON', width: 300, height: 250 },
]
