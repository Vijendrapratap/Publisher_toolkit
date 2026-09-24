/**
 * Credits charged per action (1 credit ≈ $0.10). The single source for both
 * the price shown in the UI and — once the ledger lands — the amount charged.
 * See docs/superpowers/specs/2026-09-25-auth-and-credits-design.md.
 */
export const CREDIT_PRICES = {
  'ads.copy': 1,
  'ads.image': 3,
  'ads.aplus': 4,
  'ads.video.instant': 2,
  'ads.video.ai': 10, // per 5s shot
} as const

export type AdGoal = 'aplus' | 'sponsored' | 'video'

export function goalCreditLabel(goal: AdGoal): string {
  if (goal === 'aplus') return `${CREDIT_PRICES['ads.aplus']} credits`
  if (goal === 'sponsored') return `${CREDIT_PRICES['ads.image']} credits`
  return `from ${CREDIT_PRICES['ads.video.instant']} credits`
}
