import type { AdPlatform } from '@/lib/services/ads/copy'

export interface CreativeSizeSpec {
  key: string
  platform: AdPlatform
  width: number
  height: number
  label?: string
  category?: 'sponsored' | 'aplus'
}

export const CREATIVE_SIZES: CreativeSizeSpec[] = [
  // Amazon Sponsored Display & Products
  {
    key: 'amazon_300x250',
    platform: 'AMAZON',
    width: 300,
    height: 250,
    label: 'Sponsored Display (300×250)',
    category: 'sponsored',
  },
  {
    key: 'amazon_1200x628',
    platform: 'AMAZON',
    width: 1200,
    height: 628,
    label: 'Lockscreen & Headline Banner (1200×628)',
    category: 'sponsored',
  },
  // Amazon A+ Content Modules (Enhanced Brand Content for KDP & Books)
  {
    key: 'amazon_aplus_banner_970x600',
    platform: 'AMAZON',
    width: 970,
    height: 600,
    label: 'A+ Standard Header / Hero (970×600)',
    category: 'aplus',
  },
  {
    key: 'amazon_aplus_feature_970x300',
    platform: 'AMAZON',
    width: 970,
    height: 300,
    label: 'A+ Feature / Technical Banner (970×300)',
    category: 'aplus',
  },
  {
    key: 'amazon_aplus_square_300x300',
    platform: 'AMAZON',
    width: 300,
    height: 300,
    label: 'A+ Quad / Character Spotlight (300×300)',
    category: 'aplus',
  },
  // Legacy Meta / Google sizes kept for backwards compatibility
  { key: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080, label: 'Meta Feed (1080×1080)', category: 'sponsored' },
  { key: 'meta_story_1080x1920', platform: 'META', width: 1080, height: 1920, label: 'Meta Story (1080×1920)', category: 'sponsored' },
  { key: 'google_display_300x250', platform: 'GOOGLE', width: 300, height: 250, label: 'Google Display (300×250)', category: 'sponsored' },
  { key: 'google_display_728x90', platform: 'GOOGLE', width: 728, height: 90, label: 'Google Leaderboard (728×90)', category: 'sponsored' },
]

export const AMAZON_SIZES = CREATIVE_SIZES.filter((s) => s.platform === 'AMAZON')
export const AMAZON_APLUS_SIZES = CREATIVE_SIZES.filter((s) => s.category === 'aplus')
export const AMAZON_SPONSORED_SIZES = CREATIVE_SIZES.filter((s) => s.platform === 'AMAZON' && s.category === 'sponsored')
