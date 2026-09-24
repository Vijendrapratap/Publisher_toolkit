const hits = new Map<string, number[]>()

// ponytail: per-instance memory, so the effective limit is `limit × instances`;
// move to Redis or a DB counter if the free import gets abused.
export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  const limited = recent.length >= limit
  if (!limited) recent.push(now)
  hits.set(key, recent)
  return limited
}
