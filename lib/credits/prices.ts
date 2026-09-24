/**
 * Credits charged per action (1 credit ≈ $0.10). The single source for both
 * the price shown in the UI and the amount charged.
 * See docs/superpowers/specs/2026-09-25-auth-and-credits-design.md.
 */
export const CREDIT_PRICES = {
  'ads.image': 3,
  'ads.aplus': 4,
  'ads.video.instant': 2,
  /** Legacy "all" projects, created before the picker lost its bundle card. */
  'ads.bundle': 9,
  /** Per 5-second block of AI video. */
  'ads.video.ai': 10,
  /** Per aspect ratio rendered. */
  'trailer.render': 2,
  'landing.agent': 2,
  /** Per 10 minutes of narrated audio. */
  'audiobook.tts': 1,
  'creator.generate': 3,
  /** Per image. */
  'creator.illustrate': 3,
} as const

export type CreditAction = keyof typeof CREDIT_PRICES

export type AdGoal = 'aplus' | 'sponsored' | 'video'

export function goalCreditLabel(goal: AdGoal): string {
  if (goal === 'aplus') return `${CREDIT_PRICES['ads.aplus']} credits`
  if (goal === 'sponsored') return `${CREDIT_PRICES['ads.image']} credits`
  return `from ${CREDIT_PRICES['ads.video.instant']} credits`
}

/** What `/api/ads/projects/:id/generate` charges for a book's stored content goal. */
export function adsGenerationAction(goal: string | null): CreditAction {
  if (goal === 'aplus') return 'ads.aplus'
  if (goal === 'sponsored') return 'ads.image'
  if (goal === 'video') return 'ads.video.instant'
  return 'ads.bundle'
}

/** AI video is priced per started 5-second block of each shot. */
export function aiVideoUnits(durationsSec: number[]): number {
  return durationsSec.reduce((total, d) => total + Math.max(1, Math.ceil(d / 5)), 0)
}
