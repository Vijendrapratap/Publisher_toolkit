import type { AdPlatform } from '@/lib/services/ads/copy'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'

// A campaign's content goal (Image Ads / A+ / Video) decides what it makes.
// Anything else — 'all', or null on older projects — is the full bundle.

export function goalSizes(goal: string | null | undefined, platforms: readonly AdPlatform[]) {
  if (goal === 'video') return []
  return CREATIVE_SIZES.filter(
    (s) =>
      platforms.includes(s.platform) &&
      (goal === 'sponsored' || goal === 'aplus' ? s.category === goal : true)
  )
}

export function goalWantsVideo(goal: string | null | undefined, includeVideo: boolean | null | undefined) {
  if (goal === 'video') return true
  if (goal === 'sponsored' || goal === 'aplus') return false
  return includeVideo !== false
}
