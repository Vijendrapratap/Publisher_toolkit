/**
 * Credit packs sold through Razorpay. Amounts are in paise (₹1 = 100).
 * ponytail: prices are a first guess at the spec's ~$10 / 100 credits — tune freely.
 */
export const CREDIT_PACKS = [
  { key: 'starter', credits: 100, amount: 89_900, label: 'Starter' },
  { key: 'pro', credits: 500, amount: 3_99_900, label: 'Pro', note: 'Save 11%' },
  { key: 'studio', credits: 1500, amount: 10_49_900, label: 'Studio', note: 'Save 22%' },
] as const

export type CreditPack = (typeof CREDIT_PACKS)[number]
export const PACK_CURRENCY = 'INR'

export function getPack(key: unknown): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.key === key)
}

export const formatInr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)
