// Margin per action: node scripts/credit-report.mjs [days=30]
import { PrismaClient } from '@prisma/client'

const days = Number(process.argv[2] ?? 30)
const prisma = new PrismaClient()
try {
  const rows = await prisma.$queryRaw`
    SELECT r.action,
           COUNT(*)::int                                   AS runs,
           SUM(-r.delta - COALESCE(f.delta, 0))::int        AS credits_charged,
           SUM(r."costUsd")                                 AS cost_usd,
           COUNT(*) FILTER (WHERE r."costUsd" IS NULL)::int AS cost_unknown
    FROM "CreditLedger" r
    LEFT JOIN "CreditLedger" f ON f."idempotencyKey" = 'refund:' || r."idempotencyKey"
    WHERE r.kind = 'reserve' AND r.settled AND r."createdAt" > now() - make_interval(days => ${days}::int)
    GROUP BY r.action ORDER BY credits_charged DESC`
  console.table(
    rows.map((r) => ({
      ...r,
      revenue_usd: (r.credits_charged * 0.1).toFixed(2),
      cost_usd: r.cost_usd == null ? '—' : Number(r.cost_usd).toFixed(2),
      margin: r.cost_usd ? `${((r.credits_charged * 0.1) / Number(r.cost_usd)).toFixed(1)}×` : '—',
    }))
  )
} finally {
  await prisma.$disconnect()
}
