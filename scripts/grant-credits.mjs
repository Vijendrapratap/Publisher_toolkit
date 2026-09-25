// Support/ops: node scripts/grant-credits.mjs <userId> <credits> [reason]
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const [userId, raw, reason = 'manual'] = process.argv.slice(2)
const credits = Number(raw)
if (!userId || !Number.isInteger(credits) || credits === 0) {
  console.error('usage: node scripts/grant-credits.mjs <userId> <credits> [reason]')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  await prisma.$transaction([
    prisma.creditLedger.create({
      data: { userId, delta: credits, kind: 'adjust', action: reason, settled: true, idempotencyKey: `adjust:${randomUUID()}` },
    }),
    prisma.user.update({ where: { id: userId }, data: { balance: { increment: credits } } }),
  ])
  const { balance } = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  console.log(`${userId}: ${credits > 0 ? '+' : ''}${credits} → balance ${balance}`)
} finally {
  await prisma.$disconnect()
}
